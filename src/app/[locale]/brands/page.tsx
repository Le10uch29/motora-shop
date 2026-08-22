import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import { catalogBrands } from "@/lib/brands";
import { products } from "@/lib/products";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export default async function BrandsPage({
  params,
}: PageProps<"/[locale]/brands">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {dict.header.brands}
      </h1>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {catalogBrands.map((brand) => {
          const count = products.filter((p) => p.brand === brand.slug).length;
          return (
            <Link
              key={brand.slug}
              href={`/${locale}/brands/${brand.slug}`}
              className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex aspect-[4/3] w-full items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                {brand.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={brand.logo}
                    alt={brand.name}
                    className="h-full w-full object-contain p-8"
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
    </main>
  );
}
