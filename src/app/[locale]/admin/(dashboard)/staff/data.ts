import { createAdminClient } from "@/lib/supabase/admin";
import { listAllAuthUsers } from "@/lib/supabase/authUsers";
import { ADMIN_PAGE_SIZE } from "@/components/admin/Pagination";
import { getWarehouseOptions } from "../warehouses/data";
import type { StaffRow } from "./StaffListClient";

export async function getStaffList(
  role: "admin" | "seller",
  options: { query?: string; page?: number } = {}
): Promise<{ rows: StaffRow[]; total: number }> {
  const admin = createAdminClient();

  const { data: staffRows } = await admin
    .from("staff")
    .select("id, first_name, last_name, phone, id_card_number, role, warehouse_id")
    .eq("role", role)
    .order("created_at", { ascending: false });

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
    idCardNumber: row.id_card_number ?? "",
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
