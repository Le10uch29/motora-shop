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
        {/* Just the picture, whole and uncropped at its own proportions. The
            heading stays for screen readers and search engines only. */}
        <h1 className="sr-only">{dict.home.heroTitle}</h1>
        <div className="overflow-hidden rounded-3xl shadow-xl">
          <Image
            src="/hero-1.jpeg"
            alt=""
            width={738}
            height={500}
            preload
            quality={100}
            sizes="100vw"
            className="h-auto w-full"
          />
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
