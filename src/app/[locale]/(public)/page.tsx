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
      <section className="mx-auto w-full max-w-[120rem] px-4 pt-6 sm:px-2">
        <div className="relative min-h-[420px] overflow-hidden rounded-3xl shadow-xl sm:min-h-[480px] lg:min-h-[560px]">
          <Image
            src="/hero-1.jpeg"
            alt=""
            fill
            preload
            quality={100}
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/90 via-zinc-950/70 to-zinc-950/20" />
          <div className="relative flex h-full flex-col justify-center gap-4 px-6 py-14 text-white sm:px-10 lg:px-14">
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
