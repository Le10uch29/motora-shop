import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { requireStaff } from "@/lib/auth";
import { single } from "@/lib/searchParams";
import {
  getAdminProducts,
  getBrandOptions,
  getProductsGrandTotal,
  getZeroStockProductsCount,
  PRODUCTS_PAGE_SIZE,
} from "./data";
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

  // Warehouse data (names, per-warehouse stock) is admin-only UI in
  // ProductsListClient — don't even fetch it for a seller, since props on a
  // Server Component still reach the browser in the RSC payload whether or
  // not the client actually renders them.
  const isAdmin = staff.role === "admin";

  // All independent of each other, so they go together: one wait of ~330ms
  // instead of six.
  const [{ rows, total }, searchTotal, brands, warehouses, stockByProduct, zeroStockCount] =
    await Promise.all([
      getAdminProducts(locale, { query, page }),
      query ? getProductsGrandTotal() : null,
      getBrandOptions(),
      isAdmin ? getWarehouseOptions() : [],
      isAdmin ? getProductStockMap() : {},
      isAdmin ? getZeroStockProductsCount() : 0,
    ]);
  const grandTotal = searchTotal ?? total;

  return (
    <main className="flex w-full flex-1 flex-col gap-6 px-2 py-10">
      <ProductsListClient
        locale={locale}
        dict={dict.admin}
        isAdmin={isAdmin}
        rows={rows}
        total={grandTotal}
        zeroStockCount={zeroStockCount}
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
