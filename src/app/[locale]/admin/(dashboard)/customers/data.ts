import { createAdminClient } from "@/lib/supabase/admin";
import { listAllAuthUsers } from "@/lib/supabase/authUsers";
import { isPhoneAliasEmail } from "@/lib/phoneLogin";
import { ADMIN_PAGE_SIZE } from "@/components/admin/Pagination";
import type { Locale } from "@/i18n/locales";
import type { OrderStatus } from "../orders/data";
import type { CustomerRow } from "./CustomerListClient";

export async function getCustomersList(
  options: { query?: string; page?: number } = {}
): Promise<{ rows: CustomerRow[]; total: number }> {
  const admin = createAdminClient();

  const [{ data: customerRows }, authUsers] = await Promise.all([
    admin
      .from("customers")
      .select(
        "id, first_name, last_name, phone, id_card_number, organization_name, organization_id_number, address, city, photo_url"
      )
      .order("created_at", { ascending: false }),
    listAllAuthUsers(admin),
  ]);
  // A phone-derived stand-in address isn't a real contact — it exists only so
  // the account can be signed into by phone, so it reads as "no email" here.
  const emailById = new Map(
    authUsers.map((u) => [u.id, isPhoneAliasEmail(u.email) ? "" : u.email ?? ""])
  );

  let rows: CustomerRow[] = (customerRows ?? []).map((row) => ({
    id: row.id,
    email: emailById.get(row.id) ?? "",
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    idCardNumber: row.id_card_number,
    organizationName: row.organization_name,
    organizationIdNumber: row.organization_id_number,
    address: row.address,
    city: row.city,
    photoUrl: row.photo_url,
  }));

  const query = options.query?.trim().toLowerCase();
  if (query) {
    rows = rows.filter((row) =>
      `${row.firstName} ${row.lastName} ${row.email} ${row.phone} ${row.organizationName}`
        .toLowerCase()
        .includes(query)
    );
  }

  const total = rows.length;
  const page = options.page && options.page > 0 ? options.page : 1;
  const start = (page - 1) * ADMIN_PAGE_SIZE;

  return { rows: rows.slice(start, start + ADMIN_PAGE_SIZE), total };
}

/** Одна позиция заказа. */
export type PurchaseLine = {
  id: string;
  productName: string;
  productCode: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  status: OrderStatus;
};

/** Один оформленный заказ: дата, номер и его позиции. */
export type PurchaseOrder = {
  orderNumber: number;
  createdAt: string;
  lines: PurchaseLine[];
  total: number;
  /** Статус, если он одинаков у всех позиций; иначе null — в заказе их
   * несколько, и один общий статус был бы неправдой. */
  status: OrderStatus | null;
};

/**
 * Что покупатель купил — сгруппировано по заказам, а не плоским списком
 * позиций.
 *
 * Номер заказа выдаётся один на всё оформление (см. триггер
 * orders_set_order_number в schema.sql), поэтому группировка по нему и есть
 * «заказ». Администратор видит «в такой-то день оформлен заказ», а что
 * именно в нём — в подробностях.
 *
 * Отличается от журнала «история» ниже на той же странице: тот про правки
 * карточки покупателя, а не про покупки.
 */
export async function getCustomerPurchaseOrders(
  customerId: string,
  locale: Locale
): Promise<PurchaseOrder[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select(
      "id, order_number, product_name, quantity, status, created_at, price_at_order, discounted_price, products(product_code)"
    )
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  const byOrder = new Map<number, PurchaseOrder>();

  for (const row of data ?? []) {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    // Цена со скидкой перекрывает обычную — так же, как в самом разделе заказов.
    const unitPrice = Number(row.discounted_price ?? row.price_at_order);
    const line: PurchaseLine = {
      id: row.id,
      productName: row.product_name?.[locale] ?? row.product_name?.ru ?? "",
      productCode: product?.product_code ?? null,
      quantity: row.quantity,
      unitPrice,
      lineTotal: unitPrice * row.quantity,
      status: row.status,
    };

    const order =
      byOrder.get(row.order_number) ??
      byOrder
        .set(row.order_number, {
          orderNumber: row.order_number,
          createdAt: row.created_at,
          lines: [],
          total: 0,
          status: row.status,
        })
        .get(row.order_number)!;

    order.lines.push(line);
    order.total += line.lineTotal;
    if (order.status !== row.status) order.status = null;
    // Дата заказа — самая ранняя его строка: все строки одного оформления
    // создаются вместе, но порядок внутри запроса не гарантирован.
    if (row.created_at < order.createdAt) order.createdAt = row.created_at;
  }

  return [...byOrder.values()];
}
