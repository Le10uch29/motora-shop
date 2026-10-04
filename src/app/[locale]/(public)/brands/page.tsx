import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { getCatalogBrands } from "@/lib/brands";
import { getProductCountsByBrandSlug } from "@/lib/products";
import { single } from "@/lib/searchParams";
import Breadcrumbs from "@/components/Breadcrumbs";
import Pagination from "@/components/Pagination";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

const BRANDS_PAGE_SIZE = 12;

export default async function BrandsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/brands">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const [allBrands, counts] = await Promise.all([
    getCatalogBrands(),
    getProductCountsByBrandSlug(),
  ]);

  // Брендов десятки, а не тысячи, и список уже закэширован целиком — режем
  // страницу здесь, не гоняя отдельный запрос на каждую.
  const page = Number(single((await searchParams).page)) || 1;
  const safePage = Math.min(Math.max(1, page), Math.max(1, Math.ceil(allBrands.length / BRANDS_PAGE_SIZE)));
  const catalogBrands = allBrands.slice(
    (safePage - 1) * BRANDS_PAGE_SIZE,
    safePage * BRANDS_PAGE_SIZE
  );

  return (
    <main className="mx-auto flex w-full max-w-[120rem] flex-1 flex-col gap-6 px-2 py-10">
      <Breadcrumbs
        locale={locale}
        labels={{ home: dict.catalog.breadcrumbHome, back: dict.catalog.backButton }}
        items={[{ label: dict.header.brands }]}
      />
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {dict.header.brands}
      </h1>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {catalogBrands.map((brand) => {
          const count = counts[brand.slug] ?? 0;
          return (
            <Link
              key={brand.slug}
              href={`/${locale}/brands/${brand.slug}`}
              className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex aspect-[4/3] w-full items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                {brand.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brand.logoUrl}
                    alt={brand.name}
                    className="h-full w-full object-contain p-8"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="text-4xl font-bold text-zinc-400 dark:text-zinc-600">
                    {initials(brand.name)}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1 p-4">
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {brand.name}
                </span>
                <span className="text-sm text-zinc-500">{dict.catalog.productCount(count)}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <Pagination
        basePath={`/${locale}/brands`}
        currentPage={safePage}
        total={allBrands.length}
        pageSize={BRANDS_PAGE_SIZE}
        searchParams={{}}
      />
    </main>
  );
}
