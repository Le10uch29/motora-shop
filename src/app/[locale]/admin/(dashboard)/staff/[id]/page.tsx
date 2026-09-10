import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWarehouseOptions } from "../../warehouses/data";
import { actionLabel } from "../../logs/labels";
import DetailsToggle, { type LogDetails } from "../../logs/DetailsToggle";
import StaffDetailActions from "./StaffDetailActions";

export default async function StaffDetailPage({
  params,
}: PageProps<"/[locale]/admin/staff/[id]">) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = await getDictionary(locale);

  const admin = createAdminClient();

  const { data: row } = await admin
    .from("staff")
    .select("id, first_name, last_name, phone, id_card_number, role, warehouse_id, created_at")
    .eq("id", id)
    .single();

  if (!row) notFound();

  const { data: userData } = await admin.auth.admin.getUserById(id);
  const warehouses = await getWarehouseOptions();
  const warehouseName = row.warehouse_id
    ? warehouses.find((w) => w.id === row.warehouse_id)?.name ?? ""
    : "";

  const { data: entries } = await admin
    .from("logs")
    .select("id, action, entity_type, entity_label, details, created_at")
    .eq("entity_type", "staff")
    .eq("entity_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  const fields: [string, string][] = [
    [dict.admin.firstNameLabel, row.first_name],
    [dict.admin.lastNameLabel, row.last_name],
    ["Email", userData.user?.email ?? "—"],
    [dict.admin.phoneLabel, row.phone ?? "—"],
    [dict.admin.idCardLabel, row.id_card_number ?? "—"],
    [dict.admin.roleLabel, row.role === "admin" ? dict.admin.roleAdmin : dict.admin.roleSeller],
    [dict.admin.warehouseAssignedLabel, warehouseName || "—"],
    [dict.admin.tableId, row.id],
  ];

  const backHref = `/${locale}/admin/staff/${row.role === "admin" ? "admins" : "sellers"}`;
  const backLabel = row.role === "admin" ? dict.admin.navStaffAdmins : dict.admin.navStaffSellers;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-2 py-10">
      <Link href={backHref} className="text-sm text-zinc-500 hover:text-orange-600">
        ← {backLabel}
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {dict.admin.detailsTitle}
        </h1>
        <StaffDetailActions
          locale={locale}
          dict={dict.admin}
          passwordLabel={dict.auth.passwordLabel}
          values={{
            id: row.id,
            email: userData.user?.email ?? "",
            firstName: row.first_name,
            lastName: row.last_name,
            phone: row.phone ?? "",
            idCardNumber: row.id_card_number ?? "",
            role: row.role,
            warehouseId: row.warehouse_id ?? "",
          }}
          warehouses={warehouses}
        />
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-xl border border-zinc-200 p-6 sm:grid-cols-2 dark:border-zinc-800">
        {fields.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
            <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{dict.admin.historyTitle}</h2>
        {entries && entries.length > 0 ? (
          <ul className="flex flex-col divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-zinc-700 dark:text-zinc-300">
                    {actionLabel(dict.admin, entry.action)} · {entry.entity_type} · {entry.entity_label}
                  </span>
                  <DetailsToggle dict={dict.admin} details={entry.details as LogDetails | null} />
                </div>
                <span className="shrink-0 text-xs text-zinc-400">
                  {new Date(entry.created_at).toLocaleString(locale)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">{dict.admin.historyComingSoon}</p>
        )}
      </div>
    </main>
  );
}
