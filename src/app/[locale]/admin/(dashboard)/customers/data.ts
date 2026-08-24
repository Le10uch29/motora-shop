import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_PAGE_SIZE } from "@/components/admin/Pagination";
import type { CustomerRow } from "./CustomerListClient";

export async function getCustomersList(
  options: { query?: string; page?: number } = {}
): Promise<{ rows: CustomerRow[]; total: number }> {
  const admin = createAdminClient();

  const { data: customerRows } = await admin
    .from("customers")
    .select(
      "id, first_name, last_name, phone, id_card_number, organization_name, address, postal_code, city, photo_url"
    )
    .order("created_at", { ascending: false });

  const { data: usersList } = await admin.auth.admin.listUsers();
  const emailById = new Map(usersList.users.map((u) => [u.id, u.email ?? ""]));

  let rows: CustomerRow[] = (customerRows ?? []).map((row) => ({
    id: row.id,
    email: emailById.get(row.id) ?? "",
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    idCardNumber: row.id_card_number,
    organizationName: row.organization_name,
    address: row.address,
    postalCode: row.postal_code,
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
