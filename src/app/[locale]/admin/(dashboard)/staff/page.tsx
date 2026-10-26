import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireStaffManager } from "@/lib/auth";
import { single } from "@/lib/searchParams";
import { assignableRoles, isStaffRole, roleLabel, STAFF_ROLES } from "@/lib/roles";
import { getStaffList } from "./data";
import { getWarehouseOptions } from "../warehouses/data";
import StaffListClient from "./StaffListClient";
import AdminSearchBox from "@/components/admin/AdminSearchBox";
import Pagination from "@/components/admin/Pagination";

/** «Администрация» — все сотрудники одним списком: админы, старшие продавцы и
 * продавцы. Раньше админы и продавцы жили на двух отдельных страницах. */
export default async function AdministrationPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/staff">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const current = await requireStaffManager(locale);
  const dict = await getDictionary(locale);

  const sp = await searchParams;
  const query = single(sp.q) ?? "";
  const page = Number(single(sp.page)) || 1;
  const roleParam = single(sp.role) ?? "";
  const role = isStaffRole(roleParam) ? roleParam : null;

  const [{ rows, total }, warehouses] = await Promise.all([
    getStaffList(role, { query, page }),
    getWarehouseOptions(),
  ]);

  const base = `/${locale}/admin/staff`;
  const filterHref = (next: string | null) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (next) params.set("role", next);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };
  const allowedRoles = assignableRoles(current.role);

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-2 py-10">
      <StaffListClient
        locale={locale}
        dict={dict.admin}
        passwordLabel={dict.auth.passwordLabel}
        currentStaffId={current.id}
        staff={rows}
        title={dict.admin.navAdministration}
        isAdmin={current.role === "admin"}
        allowedRoles={allowedRoles}
        emptyMessage={query ? dict.admin.noResults : dict.admin.emptyStaff}
        warehouses={warehouses}
        searchSlot={
          <div key="search" className="flex flex-col gap-3">
            <form className="flex items-center gap-2">
              <AdminSearchBox defaultValue={query} placeholder={dict.admin.searchPlaceholder} />
              {role && <input type="hidden" name="role" value={role} />}
            </form>
            <div className="flex flex-wrap items-center gap-2">
              {([null, ...STAFF_ROLES.slice().reverse()] as (string | null)[]).map((option) => {
                const active = option === role;
                return (
                  <Link
                    key={option ?? "all"}
                    href={filterHref(option)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                        : "border border-zinc-200 text-zinc-600 hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {option && isStaffRole(option) ? roleLabel(option, dict.admin) : dict.admin.staffFilterAll}
                    {active && ` · ${total}`}
                  </Link>
                );
              })}
            </div>
          </div>
        }
      />

      <Pagination
        basePath={base}
        currentPage={page}
        total={total}
        searchParams={{ q: query || undefined, role: role ?? undefined }}
      />
    </main>
  );
}
