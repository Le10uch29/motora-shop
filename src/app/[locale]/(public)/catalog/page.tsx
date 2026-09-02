import Link from "next/link";
import { notFound } from "next/navigation";
import {
  categoryIds,
  categoryLabels,
  filterProducts,
  getAllProducts,
  t,
  type CategoryId,
} from "@/lib/products";
import { getBrands } from "@/lib/brands";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { single, toNumber } from "@/lib/searchParams";
import ProductCard from "@/components/ProductCard";
import Pagination from "@/components/Pagination";

const CATALOG_PAGE_SIZE = 12;

function isCategoryId(value: string | undefined): value is CategoryId {
  return categoryIds.includes(value as CategoryId);
}

export default async function CatalogPage({
  params,
  searchParams,
}: PageProps<"/[locale]/catalog">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const brands = await getBrands();

  const sp = await searchParams;
  const category = isCategoryId(single(sp.category)) ? (single(sp.category) as CategoryId) : undefined;
  const query = single(sp.q)?.trim() || undefined;
  const make = single(sp.make) || undefined;
  const model = single(sp.model) || undefined;
  const brand = single(sp.brand) || undefined;
  const priceMin = toNumber(single(sp.priceMin));
  const priceMax = toNumber(single(sp.priceMax));
  const yearFrom = toNumber(single(sp.yearFrom));
  const yearTo = toNumber(single(sp.yearTo));
  const page = Number(single(sp.page)) || 1;

  const hasActiveFilters = Boolean(make || model || brand || priceMin !== undefined || priceMax !== undefined || yearFrom !== undefined || yearTo !== undefined);

  function hrefForCategory(target?: CategoryId): string {
    const searchParamsObj = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (key === "category" || key === "page") continue;
      const v = single(value);
      if (v) searchParamsObj.set(key, v);
    }
    if (target) searchParamsObj.set("category", target);
    const qs = searchParamsObj.toString();
    return qs ? `/${locale}/catalog?${qs}` : `/${locale}/catalog`;
  }

  const allProducts = await getAllProducts();
  const items = filterProducts(
    allProducts,
    { category, query, make, model, brand, priceMin, priceMax, yearFrom, yearTo },
    locale
  );
  const pageStart = (page - 1) * CATALOG_PAGE_SIZE;
  const pageItems = items.slice(pageStart, pageStart + CATALOG_PAGE_SIZE);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {dict.catalog.title}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {dict.catalog.productCount(items.length)}
          {category ? dict.catalog.inCategory(t(categoryLabels[category], locale)) : ""}
          {query ? ` ${dict.catalog.forQuery(query)}` : ""}
          {hasActiveFilters && (
            <>
              {" · "}
              <Link
                href={category ? `/${locale}/catalog?category=${category}` : `/${locale}/catalog`}
                className="text-orange-600 hover:underline"
              >
                {dict.catalog.clearFilters}
              </Link>
            </>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={hrefForCategory()}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            !category
              ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
              : "border border-zinc-200 text-zinc-700 hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
          }`}
        >
          {dict.catalog.all}
        </Link>
        {categoryIds.map((c) => (
          <Link
            key={c}
            href={hrefForCategory(c)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              category === c
                ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                : "border border-zinc-200 text-zinc-700 hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            {t(categoryLabels[c], locale)}
          </Link>
        ))}
      </div>

      {pageItems.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((product) => (
            <ProductCard key={product.id} product={product} locale={locale} dict={dict} brands={brands} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-zinc-500">{dict.catalog.empty}</p>
      )}

      <Pagination
        basePath={`/${locale}/catalog`}
        currentPage={page}
        total={items.length}
        pageSize={CATALOG_PAGE_SIZE}
        searchParams={{
          category,
          q: query,
          make,
          model,
          brand,
          priceMin: priceMin?.toString(),
          priceMax: priceMax?.toString(),
          yearFrom: yearFrom?.toString(),
          yearTo: yearTo?.toString(),
        }}
      />
    </main>
  );
}
