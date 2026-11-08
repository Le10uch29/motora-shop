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
  parseProductFilter,
  parseProductSort,
  PRODUCT_FILTERS,
  PRODUCTS_PAGE_SIZE,
  type ProductFilter,
} from "./data";
import Link from "next/link";
import { getWarehouseOptions, getProductStockMap } from "../warehouses/data";
import { getAdminCategoryTree } from "../categories/data";
import { categoryPicker } from "../categories/options";
import ProductsListClient from "./ProductsListClient";
import BrandFilterSelect from "./BrandFilterSelect";
import AdminSearchBox from "@/components/admin/AdminSearchBox";
import Pagination from "@/components/admin/Pagination";
import { canEditProducts } from "@/lib/roles";

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
  const sort = parseProductSort(single(sp.sort), single(sp.dir));
  const filter = parseProductFilter(single(sp.filter));
  // Товары одного Excel-импорта — ссылка «Товары» из «Истории импортов».
  const importParam = single(sp.import) ?? "";
  const importRunId = /^[0-9a-f-]{36}$/i.test(importParam) ? importParam : null;
  // Фильтр «Бренд» — id бренда из таблицы brands.
  const brandParam = single(sp.brand) ?? "";
  const brandId = /^[0-9a-f-]{36}$/i.test(brandParam) ? brandParam : null;
  const d = dict.dashboard;
  const filterLabels: Record<ProductFilter, string> = {
    in_stock: d.kpiInStock,
    out_of_stock: d.kpiOutOfStock,
    low_stock: d.kpiLowStock,
    no_photo: d.attentionNoPhoto,
    no_price: d.attentionNoPrice,
    no_vehicle: d.attentionNoVehicle,
    no_oem: dict.admin.missingDataFilterOriginCode,
  };
  const filterHref = (next: ProductFilter | null) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (sort) {
      params.set("sort", sort.key);
      params.set("dir", sort.dir);
    }
    if (next) params.set("filter", next);
    if (brandId) params.set("brand", brandId);
    const qs = params.toString();
    return `/${locale}/admin/products${qs ? `?${qs}` : ""}`;
  };

  // Warehouse data (names, per-warehouse stock) is admin-only UI in
  // ProductsListClient — don't even fetch it for a seller, since props on a
  // Server Component still reach the browser in the RSC payload whether or
  // not the client actually renders them.
  const isAdmin = staff.role === "admin";
  // «Проверить» на дашборде (блок импорта) ведёт сюда с ?review=conflicts —
  // сразу открываем окно «Требуют проверки», а не просто список товаров.
  const openConflicts = isAdmin && single(sp.review) === "conflicts";

  // All independent of each other, so they go together: one wait of ~330ms
  // instead of six.
  const [
    { rows, total },
    searchTotal,
    brands,
    categoryTree,
    warehouses,
    stockByProduct,
    zeroStockCount,
  ] = await Promise.all([
    getAdminProducts(locale, { query, page, sort, filter, importRunId, brandId }),
    query || filter || importRunId || brandId ? getProductsGrandTotal() : null,
    getBrandOptions(),
    // Категория нужна форме товара — её открывает и продавец.
    canEditProducts(staff.role) ? getAdminCategoryTree() : [],
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
        canEdit={canEditProducts(staff.role)}
        rows={rows}
        sort={sort}
        total={grandTotal}
        zeroStockCount={zeroStockCount}
        initialConflictsOpen={openConflicts}
        brands={brands}
        brandId={brandId}
        categoryTree={categoryPicker(categoryTree, locale)}
        warehouses={warehouses}
        stockByProduct={stockByProduct}
        searchSlot={
          <div key="search" className="flex flex-col gap-3">
            <form className="flex items-center gap-2">
              <AdminSearchBox defaultValue={query} placeholder={dict.admin.searchPlaceholder} />
              {/* Поиск не сбрасывает выбранный фильтр и сортировку. */}
              {filter && <input type="hidden" name="filter" value={filter} />}
              {importRunId && <input type="hidden" name="import" value={importRunId} />}
              {brandId && <input type="hidden" name="brand" value={brandId} />}
              {sort && <input type="hidden" name="sort" value={sort.key} />}
              {sort && <input type="hidden" name="dir" value={sort.dir} />}
            </form>
            {(isAdmin || importRunId) && (
              <div className="flex flex-wrap items-center gap-2">
                {importRunId && (
                  <Link
                    href={`/${locale}/admin/products`}
                    className="rounded-full bg-orange-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-orange-500"
                  >
                    {dict.admin.importFilterChip} · {total} ✕
                  </Link>
                )}
                {isAdmin && (
                  <Link
                    href={`/${locale}/admin/products/imports`}
                    className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    {dict.admin.importHistoryButton}
                  </Link>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <BrandFilterSelect
                brands={brands}
                value={brandId}
                label={dict.admin.brandFilterLabel}
                allLabel={dict.admin.brandFilterAll}
              />
              {brandId && (
                <span className="text-xs text-zinc-500">
                  {dict.admin.brandFilterFound} {total}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {([null, ...PRODUCT_FILTERS] as (ProductFilter | null)[]).map((option) => {
                const active = option === filter;
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
                    {option ? filterLabels[option] : d.kpiProductsTotal}
                    {active && ` · ${total}`}
                  </Link>
                );
              })}
            </div>
          </div>
        }
      />

      <Pagination
        basePath={`/${locale}/admin/products`}
        currentPage={page}
        total={total}
        pageSize={PRODUCTS_PAGE_SIZE}
        searchParams={{
          q: query || undefined,
          sort: sort?.key,
          dir: sort?.dir,
          filter: filter ?? undefined,
          import: importRunId ?? undefined,
          brand: brandId ?? undefined,
        }}
      />
    </main>
  );
}
