import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { filterProducts, localizedMakes, getProductsByBrandSlug, computeModelsByMake } from "@/lib/products";
import { getBrands, getBrandBySlug } from "@/lib/brands";
import { locales, isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { single, toNumber } from "@/lib/searchParams";
import ProductCard from "@/components/ProductCard";
import BrandSearch from "@/components/BrandSearch";

export async function generateStaticParams() {
  const brands = await getBrands();
  return locales.flatMap((locale) => brands.map((brand) => ({ locale, slug: brand.slug })));
}

export default async function BrandDetailPage({
  params,
  searchParams,
}: PageProps<"/[locale]/brands/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const brand = await getBrandBySlug(slug);
  if (!brand) notFound();
  const dict = await getDictionary(locale);

  const sp = await searchParams;
  const query = single(sp.q)?.trim() || undefined;
  const make = single(sp.make) || undefined;
  const model = single(sp.model) || undefined;
  const priceMin = toNumber(single(sp.priceMin));
  const priceMax = toNumber(single(sp.priceMax));
  const yearFrom = toNumber(single(sp.yearFrom));
  const yearTo = toNumber(single(sp.yearTo));

  const hasActiveFilters = Boolean(
    query || make || model || priceMin !== undefined || priceMax !== undefined || yearFrom !== undefined || yearTo !== undefined
  );

  const brandProducts = await getProductsByBrandSlug(brand.slug);
  const items = filterProducts(
    brandProducts,
    { query, make, model, priceMin, priceMax, yearFrom, yearTo },
    locale
  );

  const brandMakeIds = Array.from(new Set(brandProducts.map((p) => p.make)));
  const brandMakes = localizedMakes(brandMakeIds, locale);
  const brandModelsByMake = computeModelsByMake(brandProducts);

  const brandPrices = brandProducts.map((p) => p.price);
  const maxPrice = brandPrices.length > 0 ? Math.max(...brandPrices) : 0;

  const basePath = `/${locale}/brands/${slug}`;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {brand.name}
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            {dict.catalog.productCount(items.length)}
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
        <Suspense fallback={<div className="h-9 w-full max-w-sm rounded-full bg-zinc-100 dark:bg-zinc-800" />}>
          <BrandSearch
            basePath={basePath}
            dict={dict.search}
            carMakes={brandMakes}
            modelsByMake={brandModelsByMake}
            maxPrice={maxPrice}
          />
        </Suspense>
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} locale={locale} dict={dict} brands={[brand]} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-zinc-500">{dict.catalog.empty}</p>
      )}
    </main>
  );
}
