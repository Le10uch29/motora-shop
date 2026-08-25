import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireStaff } from "@/lib/auth";
import { single } from "@/lib/searchParams";
import { getAdminProducts, getBrandOptions } from "./data";
import { getWarehouseOptions, getProductStockMap } from "../warehouses/data";
import ProductsListClient from "./ProductsListClient";
import AdminSearchBox from "@/components/admin/AdminSearchBox";
import Pagination from "@/components/admin/Pagination";

export default async function AdminProductsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/admin/products">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const staff = await requireStaff(locale);
  const dict = await getDictionary(locale);

  const sp = await searchParams;
  const query = single(sp.q) ?? "";
  const page = Number(single(sp.page)) || 1;

  const { rows, total } = await getAdminProducts(locale, { query, page });
  const brands = await getBrandOptions();
  const warehouses = await getWarehouseOptions();
  const stockByProduct = await getProductStockMap();

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-6 py-10">
      <ProductsListClient
        locale={locale}
        dict={dict.admin}
        isAdmin={staff.role === "admin"}
        rows={rows}
        brands={brands}
        warehouses={warehouses}
        stockByProduct={stockByProduct}
        searchSlot={
          <form className="flex items-center gap-2">
            <AdminSearchBox defaultValue={query} placeholder={dict.admin.searchPlaceholder} />
          </form>
        }
      />

      <Pagination
        basePath={`/${locale}/admin/products`}
        currentPage={page}
        total={total}
        searchParams={{ q: query || undefined }}
      />
    </main>
  );
}
