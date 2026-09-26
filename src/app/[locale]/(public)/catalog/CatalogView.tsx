import Link from "next/link";
import { getCatalogPage, getInStockProductCount } from "@/lib/products";
import { getBrands } from "@/lib/brands";
import {
  getPublicCategoryTree,
  getCategoryProductCounts,
  categoryProductTotal,
  categoryIdsWithin,
  productIdsInCategories,
  type Category,
} from "@/lib/categories";
import { getDictionary } from "@/i18n/getDictionary";
import { single, toNumber } from "@/lib/searchParams";
import type { Locale } from "@/i18n/locales";
import ProductCard from "@/components/ProductCard";
import Pagination from "@/components/Pagination";
import CategorySidebar, { type SidebarCategory } from "@/components/CategorySidebar";

const CATALOG_PAGE_SIZE = 12;

type SearchParamsInput = Record<string, string | string[] | undefined>;

/**
 * The catalog, with the category sidebar down the left — shared by the whole
 * catalog and by a category's or subcategory's own page, which differ only in
 * which products they start from.
 *
 * The category filter is applied by product id rather than by joining the
 * category link table into the catalog query: see ProductFilters.productIds
 * for why. Everything else (search, make, model, years, brand) is applied by
 * getCatalogPage exactly as it was before categories existed, so the two kinds
 * of filter stack without knowing about each other.
 */
export default async function CatalogView({
  locale,
  searchParams,
  category,
  subcategory,
}: {
  locale: Locale;
  searchParams: SearchParamsInput;
  /** Set on a category page — the products shown are its own and its
   * subcategories', "Разное" included. */
  category?: Category;
  /** Set on a subcategory page — only that subcategory's products. */
  subcategory?: Category;
}) {
  const dict = await getDictionary(locale);

  const sp = searchParams;
  const query = single(sp.q)?.trim() || undefined;
  const make = single(sp.make) || undefined;
  const model = single(sp.model) || undefined;
  const brand = single(sp.brand) || undefined;
  const yearFrom = toNumber(single(sp.yearFrom));
  const yearTo = toNumber(single(sp.yearTo));
  const page = Number(single(sp.page)) || 1;

  const hasActiveFilters = Boolean(
    make || model || brand || yearFrom !== undefined || yearTo !== undefined
  );

  // Which products the category context allows, or undefined for the whole
  // shop ("Все товары" applies no category filter at all).
  let productIds: string[] | undefined;
  if (subcategory) {
    productIds = await productIdsInCategories([subcategory.id]);
  } else if (category) {
    productIds = await productIdsInCategories(await categoryIdsWithin(category.id));
  }

  const [brands, { items: pageItems, total }, tree, counts, allProductsCount] = await Promise.all([
    getBrands(),
    getCatalogPage(
      { query, make, model, brand, productIds, yearFrom, yearTo },
      locale,
      page,
      CATALOG_PAGE_SIZE
    ),
    getPublicCategoryTree(),
    getCategoryProductCounts(),
    // The whole shop, not the sum of the categories: a product nobody has
    // filed yet still sits in "Все товары".
    getInStockProductCount(),
  ]);

  const sidebarCategories: SidebarCategory[] = tree.map((node) => ({
    slug: node.slug,
    label: node.name[locale] || node.name.ru,
    count: categoryProductTotal(node, counts),
    children: node.children.map((child) => ({
      slug: child.slug,
      label: child.name[locale] || child.name.ru,
      count: counts[child.id] ?? 0,
    })),
  }));
  // Picked out one by one: dict.catalog also holds functions, which cannot be
  // handed to a Client Component.
  const sidebarLabels = {
    allProducts: dict.catalog.allProducts,
    categoriesTitle: dict.catalog.categoriesTitle,
    toggleSubcategoriesAria: dict.catalog.toggleSubcategoriesAria,
  };

  const basePath = subcategory
    ? `/${locale}/catalog/category/${category!.slug}/${subcategory.slug}`
    : category
      ? `/${locale}/catalog/category/${category.slug}`
      : `/${locale}/catalog`;

  const heading = subcategory
    ? subcategory.name[locale] || subcategory.name.ru
    : category
      ? category.name[locale] || category.name.ru
      : dict.catalog.title;

  return (
    <main className="mx-auto flex w-full max-w-[120rem] flex-1 flex-col gap-6 px-2 py-10">
      {category && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
          <Link href={`/${locale}/catalog`} className="text-orange-600 hover:underline">
            {dict.catalog.title}
          </Link>
          <span className="text-zinc-400">/</span>
          {subcategory ? (
            <>
              <Link
                href={`/${locale}/catalog/category/${category.slug}`}
                className="text-orange-600 hover:underline"
              >
                {category.name[locale] || category.name.ru}
              </Link>
              <span className="text-zinc-400">/</span>
              <span>{subcategory.name[locale] || subcategory.name.ru}</span>
            </>
          ) : (
            <span>{category.name[locale] || category.name.ru}</span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* On a phone the sidebar rides above the products as a collapsed
            block, the same way the filters do, instead of eating the width. */}
        <aside className="shrink-0 lg:sticky lg:top-24 lg:w-64 lg:self-start">
          {/* On a phone the list folds into one line that says where you are,
              so it costs a tap to browse categories instead of a screenful of
              scrolling before the first product. */}
          <details className="group rounded-xl border border-zinc-200 bg-white lg:hidden dark:border-zinc-800 dark:bg-zinc-900">
            <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              <span className="min-w-0 truncate">
                {subcategory
                  ? subcategory.name[locale] || subcategory.name.ru
                  : category
                    ? category.name[locale] || category.name.ru
                    : `${dict.catalog.allProducts} (${allProductsCount})`}
              </span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="max-h-[60vh] overflow-y-auto border-t border-zinc-200 p-2 dark:border-zinc-800">
              <CategorySidebar
                locale={locale}
                labels={sidebarLabels}
                categories={sidebarCategories}
                allProductsCount={allProductsCount}
                activeCategorySlug={category?.slug}
                activeSubcategorySlug={subcategory?.slug}
              />
            </div>
          </details>

          <div className="hidden lg:block lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
            <CategorySidebar
              locale={locale}
              labels={sidebarLabels}
              categories={sidebarCategories}
              allProductsCount={allProductsCount}
              activeCategorySlug={category?.slug}
              activeSubcategorySlug={subcategory?.slug}
            />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {heading}
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400">
              {dict.catalog.productCount(total)}
              {query ? ` ${dict.catalog.forQuery(query)}` : ""}
              {hasActiveFilters && (
                <>
                  {" · "}
                  <Link href={basePath} className="text-orange-600 hover:underline">
                    {dict.catalog.clearFilters}
                  </Link>
                </>
              )}
            </p>
          </div>

          {/* Три колонки только с xl: на ноутбуке 1024px сайдбар забирает
              256px, и третья колонка сжала бы карточки до нечитаемых. */}
          {pageItems.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3 min-[100rem]:grid-cols-4">
              {pageItems.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  locale={locale}
                  dict={dict}
                  brands={brands}
                />
              ))}
            </div>
          ) : (
            <p className="py-16 text-center text-zinc-500">{dict.catalog.empty}</p>
          )}

          <Pagination
            basePath={basePath}
            currentPage={page}
            total={total}
            pageSize={CATALOG_PAGE_SIZE}
            searchParams={{
              q: query,
              make,
              model,
              brand,
              yearFrom: yearFrom?.toString(),
              yearTo: yearTo?.toString(),
            }}
          />
        </div>
      </div>
    </main>
  );
}
