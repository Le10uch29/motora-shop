import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/auth";
import { single } from "@/lib/searchParams";
import { getStaffList } from "../data";
import { getWarehouseOptions } from "../../warehouses/data";
import StaffListClient from "../StaffListClient";
import AdminSearchBox from "@/components/admin/AdminSearchBox";
import Pagination from "@/components/admin/Pagination";

export default async function AdminsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/staff/admins">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const current = await requireAdmin(locale);
  const dict = await getDictionary(locale);

  const sp = await searchParams;
  const query = single(sp.q) ?? "";
  const page = Number(single(sp.page)) || 1;

  const { rows, total } = await getStaffList("admin", { query, page });
  const warehouses = await getWarehouseOptions();

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-3 py-10">
      <StaffListClient
        locale={locale}
        dict={dict.admin}
        passwordLabel={dict.auth.passwordLabel}
        currentStaffId={current.id}
        staff={rows}
        title={dict.admin.navStaffAdmins}
        defaultRole="admin"
        emptyMessage={query ? dict.admin.noResults : dict.admin.emptyStaff}
        warehouses={warehouses}
        searchSlot={
          <form className="flex items-center gap-2">
            <AdminSearchBox defaultValue={query} placeholder={dict.admin.searchPlaceholder} />
          </form>
        }
      />

      <Pagination
        basePath={`/${locale}/admin/staff/admins`}
        currentPage={page}
        total={total}
        searchParams={{ q: query || undefined }}
      />
    </main>
  );
}
