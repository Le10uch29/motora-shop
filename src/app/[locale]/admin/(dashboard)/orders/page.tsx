import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireStaff } from "@/lib/auth";
import { single } from "@/lib/searchParams";
import { getOrderersList, ORDERS_PAGE_SIZE } from "./data";
import OrderersListClient from "./OrderersListClient";
import AdminSearchBox from "@/components/admin/AdminSearchBox";
import Pagination from "@/components/admin/Pagination";

export default async function OrdersPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/orders">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const staff = await requireStaff(locale);
  const dict = await getDictionary(locale);

  const sp = await searchParams;
  const query = single(sp.q) ?? "";
  const page = Number(single(sp.page)) || 1;

  const { rows, total } = await getOrderersList(locale, { query, page });

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-6 py-10">
      <OrderersListClient
        locale={locale}
        dict={dict.admin}
        isAdmin={staff.role === "admin"}
        orderers={rows}
        emptyMessage={query ? dict.admin.noResults : dict.admin.emptyOrders}
        searchSlot={
          <form className="flex items-center gap-2">
            <AdminSearchBox defaultValue={query} placeholder={dict.admin.searchPlaceholder} />
          </form>
        }
      />

      <Pagination
        basePath={`/${locale}/admin/orders`}
        currentPage={page}
        total={total}
        pageSize={ORDERS_PAGE_SIZE}
        searchParams={{ q: query || undefined }}
      />
    </main>
  );
}
