import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getFeaturedProducts } from "@/lib/products";
import { getBrands } from "@/lib/brands";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import ProductCard from "@/components/ProductCard";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const [brands, featured] = await Promise.all([getBrands(), getFeaturedProducts(4)]);

  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-6xl px-2 pt-6">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-orange-900 shadow-xl">
          <div className="grid grid-cols-1 items-center gap-8 px-6 py-14 sm:px-10 lg:grid-cols-2 lg:py-0">
            <div className="flex flex-col gap-4 text-white">
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
            <div className="relative aspect-[738/500] w-full lg:h-full lg:min-h-[380px]">
              <Image
                src="/hero-1.jpeg"
                alt=""
                fill
                preload
                quality={100}
                sizes="(min-width: 1024px) 36rem, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto flex w-full max-w-[120rem] flex-col gap-6 px-2 py-12">
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
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 min-[85rem]:grid-cols-5 min-[100rem]:grid-cols-6 min-[115rem]:grid-cols-7">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} locale={locale} dict={dict} brands={brands} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
