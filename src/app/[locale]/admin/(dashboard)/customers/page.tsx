import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireAdmin } from "@/lib/auth";
import { single } from "@/lib/searchParams";
import { getCustomersList } from "./data";
import CustomerListClient from "./CustomerListClient";
import AdminSearchBox from "@/components/admin/AdminSearchBox";
import Pagination from "@/components/admin/Pagination";

export default async function CustomersPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/customers">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireAdmin(locale);
  const dict = await getDictionary(locale);

  const sp = await searchParams;
  const query = single(sp.q) ?? "";
  const page = Number(single(sp.page)) || 1;

  const { rows, total } = await getCustomersList({ query, page });

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-2 py-10">
      <CustomerListClient
        locale={locale}
        dict={dict.admin}
        customers={rows}
        emptyMessage={query ? dict.admin.noResults : dict.admin.emptyCustomers}
        searchSlot={
          <form className="flex items-center gap-2">
            <AdminSearchBox defaultValue={query} placeholder={dict.admin.searchPlaceholder} />
          </form>
        }
      />

      <Pagination
        basePath={`/${locale}/admin/customers`}
        currentPage={page}
        total={total}
        searchParams={{ q: query || undefined }}
      />
    </main>
  );
}
