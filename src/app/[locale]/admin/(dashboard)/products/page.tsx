import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireStaff } from "@/lib/auth";
import { single } from "@/lib/searchParams";
import { getAdminProducts, getBrandOptions, getProductsGrandTotal, PRODUCTS_PAGE_SIZE } from "./data";
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
  const grandTotal = query ? await getProductsGrandTotal() : total;
  const brands = await getBrandOptions();
  // Warehouse data (names, per-warehouse stock) is admin-only UI in
  // ProductsListClient — don't even fetch it for a seller, since props on a
  // Server Component still reach the browser in the RSC payload whether or
  // not the client actually renders them.
  const isAdmin = staff.role === "admin";
  const warehouses = isAdmin ? await getWarehouseOptions() : [];
  const stockByProduct = isAdmin ? await getProductStockMap() : {};

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-3 py-10">
      <ProductsListClient
        locale={locale}
        dict={dict.admin}
        isAdmin={isAdmin}
        rows={rows}
        total={grandTotal}
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
        pageSize={PRODUCTS_PAGE_SIZE}
        searchParams={{ q: query || undefined }}
      />
    </main>
  );
}
