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
        "id, first_name, last_name, phone, id_card_number, organization_name, address, city, photo_url"
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

export type CustomerPurchase = {
  id: string;
  orderNumber: number;
  productName: string;
  productCode: string | null;
  quantity: number;
  status: OrderStatus;
  createdAt: string;
};

/** What a customer has actually bought — separate from the audit-log
 * "история" further down the page (who edited the customer's own profile
 * and when), which is a different kind of history entirely. */
export async function getCustomerPurchaseHistory(
  customerId: string,
  locale: Locale
): Promise<CustomerPurchase[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("orders")
    .select("id, order_number, product_name, quantity, status, created_at, products(product_code)")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    return {
      id: row.id,
      orderNumber: row.order_number,
      productName: row.product_name?.[locale] ?? row.product_name?.ru ?? "",
      productCode: product?.product_code ?? null,
      quantity: row.quantity,
      status: row.status,
      createdAt: row.created_at,
    };
  });
}
