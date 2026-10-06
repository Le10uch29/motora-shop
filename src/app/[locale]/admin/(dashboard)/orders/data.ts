import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUserById, listAllAuthUsers } from "@/lib/supabase/authUsers";
import type { Locale } from "@/i18n/locales";

export const ORDERS_PAGE_SIZE = 20;

export type OrderStatus = "new" | "gathering" | "gathered" | "shipped" | "delivered" | "cancelled";

function effectivePrice(priceAtOrder: number, discountedPrice: number | null): number {
  return discountedPrice ?? priceAtOrder;
}

// orders.customer_id points at auth.users, not customers — a customer places
// most orders, but staff can order too (e.g. testing checkout, or ordering
// parts for the shop itself), and they don't have a customers row. There's
// no FK from orders to customers/staff for Postgrest to auto-embed, so both
// are looked up separately by id and merged in JS below.
type OrdererInfo =
  | {
      kind: "customer";
      firstName: string;
      lastName: string;
      organizationName: string;
      idCardNumber: string;
      address: string;
      city: string;
      phone: string;
      email: string;
    }
  | { kind: "staff"; firstName: string; lastName: string; phone: string; email: string };

async function resolveOrderers(
  admin: ReturnType<typeof createAdminClient>,
  ids: string[]
): Promise<Map<string, OrdererInfo>> {
  const result = new Map<string, OrdererInfo>();
  if (ids.length === 0) return result;

  // Staff is asked about the same ids rather than only the ones customers
  // didn't claim: a superset costs nothing to filter afterwards, and asking
  // all three at once turns three waits into one.
  const [{ data: customerRows }, { data: allStaffRows }, authUsers] = await Promise.all([
    admin
      .from("customers")
      .select("id, first_name, last_name, organization_name, id_card_number, address, city, phone")
      .in("id", ids),
    admin.from("staff").select("id, first_name, last_name, phone").in("id", ids),
    // One bulk fetch instead of a getUserById() per orderer — same approach
    // getStaffList()/getCustomersList() use to join emails.
    listAllAuthUsers(admin),
  ]);

  // An id that is both is treated as a customer, as before.
  const staffRows = (allStaffRows ?? []).filter(
    (row) => !(customerRows ?? []).some((customer) => customer.id === row.id)
  );
  const emailById = new Map(authUsers.map((u) => [u.id, u.email ?? ""]));

  for (const row of customerRows ?? []) {
    result.set(row.id, {
      kind: "customer",
      firstName: row.first_name,
      lastName: row.last_name,
      organizationName: row.organization_name,
      idCardNumber: row.id_card_number,
      address: row.address,
      city: row.city,
      phone: row.phone,
      email: emailById.get(row.id) ?? "",
    });
  }
  for (const row of staffRows ?? []) {
    result.set(row.id, {
      kind: "staff",
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone ?? "",
      email: emailById.get(row.id) ?? "",
    });
  }

  return result;
}

type OrderBaseRow = {
  id: string;
  order_number: number;
  product_name: Record<string, string>;
  quantity: number;
  price_at_order: number;
  discounted_price: number | null;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
  warehouse_id: string | null;
  customer_id: string;
};

/** Одна строка списка заказов — одно оформление.
 *
 * Раньше список строился по заказчику: одна строка на человека, а все его
 * оформления сливались в неё. Из-за этого четыре разных заказа выглядели как
 * один с четырьмя номерами, и в инвойс попадало всё сразу. Теперь единицей
 * списка стал сам заказ — ровно то, что покупатель оформил за один раз, и что
 * обозначено одним order_number. */
export type OrderSummaryRow = {
  orderNumber: number;
  /** Нужен для ссылок на карточку заказчика и для пересчёта его страниц. */
  customerId: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
  /** Сколько строк (товаров) в заказе. */
  lineCount: number;
  totalAmount: number;
  /** null, когда строки заказа разошлись по статусам — такое бывает, если
   * отменили часть позиций. */
  status: OrderStatus | null;
  warehouseName: string | null;
  warehouseAddress: string | null;
};

export async function getOrdersList(
  locale: Locale,
  options: { query?: string; page?: number } = {}
): Promise<{ rows: OrderSummaryRow[]; total: number }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select(
      "customer_id, order_number, quantity, price_at_order, discounted_price, status, created_at, updated_at, warehouse_id"
    )
    .order("created_at", { ascending: false });

  const baseRows = (data ?? []) as (Omit<OrderBaseRow, "id" | "product_name"> & { created_at: string })[];

  type Group = {
    orderNumber: number;
    customerId: string;
    createdAt: string;
    lineCount: number;
    total: number;
    statuses: Set<OrderStatus>;
    warehouseId: string | null;
    warehouseUpdatedAt: string;
  };
  const byNumber = new Map<number, Group>();

  for (const row of baseRows) {
    const group = byNumber.get(row.order_number) ?? {
      orderNumber: row.order_number,
      customerId: row.customer_id,
      createdAt: row.created_at,
      lineCount: 0,
      total: 0,
      statuses: new Set<OrderStatus>(),
      warehouseId: null,
      warehouseUpdatedAt: "",
    };

    group.lineCount += 1;
    group.statuses.add(row.status);
    // Дата заказа — самая ранняя из его строк: все они созданы одной вставкой,
    // но порядок возврата строк это не гарантирует.
    if (row.created_at < group.createdAt) group.createdAt = row.created_at;
    // Отменённые позиции в сумму не идут — заказ на них уже не выставляется.
    if (row.status !== "cancelled") {
      group.total += effectivePrice(Number(row.price_at_order), row.discounted_price) * row.quantity;
    }
    if (row.warehouse_id && row.updated_at > group.warehouseUpdatedAt) {
      group.warehouseId = row.warehouse_id;
      group.warehouseUpdatedAt = row.updated_at;
    }

    byNumber.set(row.order_number, group);
  }

  const groups = Array.from(byNumber.values()).sort((a, b) => b.orderNumber - a.orderNumber);
  const orderers = await resolveOrderers(
    admin,
    Array.from(new Set(groups.map((group) => group.customerId)))
  );

  const warehouseIds = Array.from(
    new Set(groups.map((group) => group.warehouseId).filter((id): id is string => Boolean(id)))
  );
  const { data: warehouseRows } =
    warehouseIds.length > 0
      ? await admin.from("warehouses").select("id, name, address").in("id", warehouseIds)
      : { data: [] as { id: string; name: string; address: string | null }[] };
  const warehouseById = new Map((warehouseRows ?? []).map((w) => [w.id, w]));

  let rows: OrderSummaryRow[] = groups
    .map((group) => {
      const info = orderers.get(group.customerId);
      if (!info) return null;
      const warehouse = group.warehouseId ? warehouseById.get(group.warehouseId) : undefined;
      // Статус заказа один на все его строки, пока их не развели вручную
      // (например, отменили часть позиций) — тогда честнее показать, что
      // единого статуса нет, чем выбрать один из них наугад.
      const statuses = Array.from(group.statuses);
      return {
        orderNumber: group.orderNumber,
        customerId: group.customerId,
        name: `${info.firstName} ${info.lastName}`,
        phone: info.phone,
        email: info.email,
        createdAt: group.createdAt,
        lineCount: group.lineCount,
        totalAmount: group.total,
        status: statuses.length === 1 ? statuses[0] : null,
        warehouseName: warehouse?.name ?? null,
        warehouseAddress: warehouse?.address ?? null,
      };
    })
    .filter((row): row is OrderSummaryRow => row !== null);

  const query = options.query?.trim().toLowerCase();
  if (query) {
    // Номер заказа ищется и с решёткой, и без неё: в переписке его пишут
    // то так, то так.
    const asNumber = query.replace(/^№/, "");
    rows = rows.filter(
      (row) =>
        `${row.name} ${row.phone} ${row.email}`.toLowerCase().includes(query) ||
        String(row.orderNumber).includes(asNumber)
    );
  }

  const total = rows.length;
  const page = options.page && options.page > 0 ? options.page : 1;
  const start = (page - 1) * ORDERS_PAGE_SIZE;

  return { rows: rows.slice(start, start + ORDERS_PAGE_SIZE), total };
}

export type OrdererOrderLine = {
  id: string;
  orderNumber: number;
  productName: string;
  /** Null when the product has since been deleted from the catalog, or never
   * had a code — the order itself only snapshots the name, not the code. */
  productCode: string | null;
  /** The manufacturer's own code for the same part, shown under the product
   * code on the invoice. Null under the same conditions. */
  originCode: string | null;
  productImage: string | null;
  quantity: number;
  priceAtOrder: number;
  discountedPrice: number | null;
  status: OrderStatus;
  createdAt: string;
};

export type OrdererProfile =
  | {
      kind: "customer";
      firstName: string;
      lastName: string;
      organizationName: string;
      idCardNumber: string;
      address: string;
      city: string;
      phone: string;
      email: string;
    }
  | { kind: "staff"; firstName: string; lastName: string; phone: string; email: string };

export async function getOrderByNumber(
  orderNumber: number,
  locale: Locale
): Promise<{
  orderNumber: number;
  customerId: string;
  createdAt: string;
  orderer: OrdererProfile;
  lines: OrdererOrderLine[];
  total: number;
  warehouseName: string | null;
  warehouseAddress: string | null;
} | null> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("orders")
    .select(
      "id, order_number, product_id, product_name, quantity, price_at_order, discounted_price, status, created_at, updated_at, warehouse_id, customer_id"
    )
    .eq("order_number", orderNumber)
    .order("created_at", { ascending: true });

  const baseRows = (data ?? []) as (OrderBaseRow & { product_id: string | null })[];
  if (baseRows.length === 0) return null;

  const customerId = baseRows[0].customer_id;
  const orderers = await resolveOrderers(admin, [customerId]);
  const orderer = orderers.get(customerId);
  if (!orderer) return null;

  const productIds = Array.from(
    new Set(baseRows.map((row) => row.product_id).filter((id): id is string => Boolean(id)))
  );
  const { data: productRows } =
    productIds.length > 0
      ? await admin.from("products").select("id, images, product_code, origin_code").in("id", productIds)
      : {
          data: [] as {
            id: string;
            images: string[] | null;
            product_code: string | null;
            origin_code: string | null;
          }[],
        };
  const imageByProductId = new Map((productRows ?? []).map((p) => [p.id, p.images?.[0] ?? null]));
  const codeByProductId = new Map((productRows ?? []).map((p) => [p.id, p.product_code ?? null]));
  const originCodeByProductId = new Map(
    (productRows ?? []).map((p) => [p.id, p.origin_code ?? null])
  );

  // Склад заказа — тот, что привязан к позиции, которую трогали последней:
  // проставляется он автоматически при смене статуса, и у строк одного
  // заказа почти всегда совпадает.
  let latestWarehouse: { warehouseId: string; updatedAt: string } | null = null;
  for (const row of baseRows) {
    if (row.status === "cancelled" || !row.warehouse_id) continue;
    if (!latestWarehouse || row.updated_at > latestWarehouse.updatedAt) {
      latestWarehouse = { warehouseId: row.warehouse_id, updatedAt: row.updated_at };
    }
  }
  let warehouseName: string | null = null;
  let warehouseAddress: string | null = null;
  if (latestWarehouse) {
    const { data: warehouseRow } = await admin
      .from("warehouses")
      .select("name, address")
      .eq("id", latestWarehouse.warehouseId)
      .maybeSingle();
    warehouseName = warehouseRow?.name ?? null;
    warehouseAddress = warehouseRow?.address ?? null;
  }

  const lines: OrdererOrderLine[] = baseRows.map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    productName: row.product_name?.[locale] ?? row.product_name?.ru ?? "",
    productCode: row.product_id ? codeByProductId.get(row.product_id) ?? null : null,
    originCode: row.product_id ? originCodeByProductId.get(row.product_id) ?? null : null,
    productImage: row.product_id ? imageByProductId.get(row.product_id) ?? null : null,
    quantity: row.quantity,
    priceAtOrder: Number(row.price_at_order),
    discountedPrice: row.discounted_price != null ? Number(row.discounted_price) : null,
    status: row.status,
    createdAt: row.created_at,
  }));

  const total = lines
    .filter((line) => line.status !== "cancelled")
    .reduce((sum, line) => sum + effectivePrice(line.priceAtOrder, line.discountedPrice) * line.quantity, 0);

  return {
    orderNumber,
    customerId,
    createdAt: baseRows.reduce(
      (earliest, row) => (row.created_at < earliest ? row.created_at : earliest),
      baseRows[0].created_at
    ),
    orderer,
    lines,
    total,
    warehouseName,
    warehouseAddress,
  };
}

export type OrderDetail = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  quantity: number;
  priceAtOrder: number;
  discountedPrice: number | null;
  productNameSnapshot: string;
  createdAt: string;
  cancelledAt: string | null;
  product: {
    id: string;
    name: string;
    brandName: string;
    originCode: string;
    productCode: string;
    stockByWarehouse: { warehouseName: string; quantity: number }[];
  } | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    idCardNumber: string;
    organizationName: string;
    address: string;
    city: string;
  } | null;
  // Set instead of `customer` when the order was placed by a staff account
  // (admin/seller testing checkout, ordering for the shop, etc.) — staff
  // don't have the customer profile fields (address, ID card...).
  staffOrderer: { firstName: string; lastName: string } | null;
};

export async function getOrderDetail(id: string, locale: Locale): Promise<OrderDetail | null> {
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("orders")
    .select(
      "id, order_number, status, quantity, price_at_order, discounted_price, product_name, created_at, cancelled_at, product_id, customer_id"
    )
    .eq("id", id)
    .single();
  if (!row) return null;

  let product: OrderDetail["product"] = null;
  if (row.product_id) {
    const { data: productRow } = await admin
      .from("products")
      .select("id, name, origin_code, product_code, brands(name)")
      .eq("id", row.product_id)
      .maybeSingle();

    if (productRow) {
      const brand = Array.isArray(productRow.brands) ? productRow.brands[0] : productRow.brands;
      const { data: stockRows } = await admin
        .from("warehouse_stock")
        .select("quantity, warehouses(name)")
        .eq("product_id", row.product_id);

      const stockByWarehouse = (stockRows ?? []).map((stockRow) => {
        const warehouse = Array.isArray(stockRow.warehouses)
          ? stockRow.warehouses[0]
          : stockRow.warehouses;
        return { warehouseName: warehouse?.name ?? "", quantity: stockRow.quantity };
      });

      product = {
        id: productRow.id,
        name: productRow.name?.[locale] ?? productRow.name?.ru ?? "",
        brandName: brand?.name ?? "",
        originCode: productRow.origin_code ?? "",
        productCode: productRow.product_code ?? "",
        stockByWarehouse,
      };
    }
  }

  const { data: customerRow } = await admin
    .from("customers")
    .select("id, first_name, last_name, phone, id_card_number, organization_name, address, city")
    .eq("id", row.customer_id)
    .maybeSingle();

  let customer: OrderDetail["customer"] = null;
  let staffOrderer: OrderDetail["staffOrderer"] = null;

  if (customerRow) {
    const authUser = await getAuthUserById(admin, customerRow.id);
    customer = {
      id: customerRow.id,
      firstName: customerRow.first_name,
      lastName: customerRow.last_name,
      email: authUser?.email ?? "",
      phone: customerRow.phone,
      idCardNumber: customerRow.id_card_number,
      organizationName: customerRow.organization_name,
      address: customerRow.address,
      city: customerRow.city,
    };
  } else {
    const { data: staffRow } = await admin
      .from("staff")
      .select("first_name, last_name")
      .eq("id", row.customer_id)
      .maybeSingle();
    if (staffRow) staffOrderer = { firstName: staffRow.first_name, lastName: staffRow.last_name };
  }

  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    quantity: row.quantity,
    priceAtOrder: Number(row.price_at_order),
    discountedPrice: row.discounted_price != null ? Number(row.discounted_price) : null,
    productNameSnapshot: row.product_name?.[locale] ?? row.product_name?.ru ?? "",
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
    product,
    customer,
    staffOrderer,
  };
}
