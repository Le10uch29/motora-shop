import { createAdminClient } from "@/lib/supabase/admin";
import type { Locale } from "@/i18n/locales";

export const ORDERS_PAGE_SIZE = 20;

export type OrderStatus = "new" | "cancelled";

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
      postalCode: string;
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

  const { data: customerRows } = await admin
    .from("customers")
    .select("id, first_name, last_name, organization_name, id_card_number, address, postal_code, city, phone")
    .in("id", ids);

  const remainingAfterCustomers = ids.filter(
    (id) => !(customerRows ?? []).some((row) => row.id === id)
  );
  const { data: staffRows } =
    remainingAfterCustomers.length > 0
      ? await admin.from("staff").select("id, first_name, last_name, phone").in("id", remainingAfterCustomers)
      : { data: [] as { id: string; first_name: string; last_name: string; phone: string | null }[] };

  // One bulk fetch instead of a getUserById() per orderer — same approach
  // getStaffList()/getCustomersList() use to join emails.
  const { data: usersList } = await admin.auth.admin.listUsers();
  const emailById = new Map(usersList.users.map((u) => [u.id, u.email ?? ""]));

  for (const row of customerRows ?? []) {
    result.set(row.id, {
      kind: "customer",
      firstName: row.first_name,
      lastName: row.last_name,
      organizationName: row.organization_name,
      idCardNumber: row.id_card_number,
      address: row.address,
      postalCode: row.postal_code,
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
  status: OrderStatus;
  created_at: string;
  customer_id: string;
};

export type OrdererRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  totalAmount: number;
};

export async function getOrderersList(
  locale: Locale,
  options: { query?: string; page?: number } = {}
): Promise<{ rows: OrdererRow[]; total: number }> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select("customer_id, quantity, price_at_order, status")
    .order("created_at", { ascending: false });

  const baseRows = (data ?? []) as Pick<OrderBaseRow, "customer_id" | "quantity" | "price_at_order" | "status">[];
  const ordererIds = Array.from(new Set(baseRows.map((row) => row.customer_id)));
  const orderers = await resolveOrderers(admin, ordererIds);

  const totalByOrderer = new Map<string, number>();
  for (const row of baseRows) {
    if (row.status !== "new") continue;
    const current = totalByOrderer.get(row.customer_id) ?? 0;
    totalByOrderer.set(row.customer_id, current + Number(row.price_at_order) * row.quantity);
  }

  let rows: OrdererRow[] = ordererIds
    .map((id) => {
      const info = orderers.get(id);
      if (!info) return null;
      return {
        id,
        name: `${info.firstName} ${info.lastName}`,
        phone: info.phone,
        email: info.email,
        totalAmount: totalByOrderer.get(id) ?? 0,
      };
    })
    .filter((row): row is OrdererRow => row !== null);

  const query = options.query?.trim().toLowerCase();
  if (query) {
    rows = rows.filter((row) => `${row.name} ${row.phone} ${row.email}`.toLowerCase().includes(query));
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
  quantity: number;
  priceAtOrder: number;
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
      postalCode: string;
      city: string;
      phone: string;
      email: string;
    }
  | { kind: "staff"; firstName: string; lastName: string; phone: string; email: string };

export async function getOrdererOrders(
  customerId: string,
  locale: Locale
): Promise<{ orderer: OrdererProfile; lines: OrdererOrderLine[]; total: number } | null> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("orders")
    .select("id, order_number, product_name, quantity, price_at_order, status, created_at, customer_id")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  const baseRows = (data ?? []) as OrderBaseRow[];
  if (baseRows.length === 0) return null;

  const orderers = await resolveOrderers(admin, [customerId]);
  const orderer = orderers.get(customerId);
  if (!orderer) return null;

  const lines: OrdererOrderLine[] = baseRows.map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    productName: row.product_name?.[locale] ?? row.product_name?.ru ?? "",
    quantity: row.quantity,
    priceAtOrder: Number(row.price_at_order),
    status: row.status,
    createdAt: row.created_at,
  }));

  const total = lines
    .filter((line) => line.status === "new")
    .reduce((sum, line) => sum + line.priceAtOrder * line.quantity, 0);

  return { orderer, lines, total };
}

export type OrderDetail = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  quantity: number;
  priceAtOrder: number;
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
    postalCode: string;
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
      "id, order_number, status, quantity, price_at_order, product_name, created_at, cancelled_at, product_id, customer_id"
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
    .select("id, first_name, last_name, phone, id_card_number, organization_name, address, postal_code, city")
    .eq("id", row.customer_id)
    .maybeSingle();

  let customer: OrderDetail["customer"] = null;
  let staffOrderer: OrderDetail["staffOrderer"] = null;

  if (customerRow) {
    const { data: userData } = await admin.auth.admin.getUserById(customerRow.id);
    customer = {
      id: customerRow.id,
      firstName: customerRow.first_name,
      lastName: customerRow.last_name,
      email: userData.user?.email ?? "",
      phone: customerRow.phone,
      idCardNumber: customerRow.id_card_number,
      organizationName: customerRow.organization_name,
      address: customerRow.address,
      postalCode: customerRow.postal_code,
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
    productNameSnapshot: row.product_name?.[locale] ?? row.product_name?.ru ?? "",
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
    product,
    customer,
    staffOrderer,
  };
}
