import Link from "next/link";
import { notFound } from "next/navigation";
import { getFeaturedProducts, categoryIds, categoryLabels, t } from "@/lib/products";
import { getBrands } from "@/lib/brands";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import ProductCard from "@/components/ProductCard";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const brands = await getBrands();
  const featured = await getFeaturedProducts(4);

  return (
    <main className="flex flex-1 flex-col">
      <section className="border-b border-zinc-200 bg-gradient-to-br from-zinc-900 via-zinc-900 to-orange-900 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-20 text-white">
          <span className="text-sm font-medium uppercase tracking-widest text-orange-400">
            {dict.home.brand}
          </span>
          <h1 className="max-w-xl text-4xl font-bold tracking-tight sm:text-5xl">
            {dict.home.heroTitle}
          </h1>
          <p className="max-w-lg text-lg text-zinc-300">{dict.home.heroSubtitle}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/${locale}/catalog`}
              className="rounded-full bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
            >
              {dict.home.ctaCatalog}
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-12">
        <div className="flex flex-wrap gap-3">
          {categoryIds.map((category) => (
            <Link
              key={category}
              href={`/${locale}/catalog?category=${category}`}
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
            >
              {t(categoryLabels[category], locale)}
            </Link>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 pb-16">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {dict.home.popular}
            </h2>
            <Link
              href={`/${locale}/catalog`}
              className="text-sm font-medium text-orange-600 hover:underline"
            >
              {dict.home.viewAll}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} dict={dict} brands={brands} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
