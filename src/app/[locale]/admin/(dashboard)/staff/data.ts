import { createAdminClient } from "@/lib/supabase/admin";
import { listAllAuthUsers } from "@/lib/supabase/authUsers";
import { ADMIN_PAGE_SIZE } from "@/components/admin/Pagination";
import { getWarehouseOptions } from "../warehouses/data";
import type { StaffRow } from "./StaffListClient";
import type { StaffRole } from "@/lib/roles";

/** Весь раздел «Администрация» — админы, старшие продавцы и продавцы одним
 * списком; `role` сужает его до одной роли. Сначала админы, потом старшие
 * продавцы, потом продавцы, внутри — новые выше. */
export async function getStaffList(
  role: StaffRole | null,
  options: { query?: string; page?: number } = {}
): Promise<{ rows: StaffRow[]; total: number }> {
  const admin = createAdminClient();

  let request = admin
    .from("staff")
    .select("id, first_name, last_name, phone, role, warehouse_id")
    .order("created_at", { ascending: false });
  if (role) request = request.eq("role", role);
  const { data: staffRows } = await request;
  const rank: Record<string, number> = { admin: 0, senior_seller: 1, seller: 2 };
  staffRows?.sort((a, b) => (rank[a.role] ?? 9) - (rank[b.role] ?? 9));

  const authUsers = await listAllAuthUsers(admin);
  const emailById = new Map(authUsers.map((u) => [u.id, u.email ?? ""]));
  const warehouses = await getWarehouseOptions();
  const warehouseNameById = new Map(warehouses.map((w) => [w.id, w.name]));

  let rows: StaffRow[] = (staffRows ?? []).map((row) => ({
    id: row.id,
    email: emailById.get(row.id) ?? "",
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone ?? "",
    role: row.role,
    warehouseId: row.warehouse_id ?? "",
    warehouseName: row.warehouse_id ? warehouseNameById.get(row.warehouse_id) ?? "" : "",
  }));

  const query = options.query?.trim().toLowerCase();
  if (query) {
    rows = rows.filter((row) =>
      `${row.firstName} ${row.lastName} ${row.email} ${row.phone}`.toLowerCase().includes(query)
    );
  }

  const total = rows.length;
  const page = options.page && options.page > 0 ? options.page : 1;
  const start = (page - 1) * ADMIN_PAGE_SIZE;

  return { rows: rows.slice(start, start + ADMIN_PAGE_SIZE), total };
}
