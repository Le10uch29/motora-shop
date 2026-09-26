import Link from "next/link";
import { notFound } from "next/navigation";
import { getFeaturedProducts } from "@/lib/products";
import { getBrands } from "@/lib/brands";
import {
  getPublicCategoryTree,
  getCategoryProductCounts,
  categoryProductTotal,
} from "@/lib/categories";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import ProductCard from "@/components/ProductCard";
import Hero from "@/components/Hero";

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const [brands, featured, tree, counts] = await Promise.all([
    getBrands(),
    getFeaturedProducts(4),
    getPublicCategoryTree(),
    getCategoryProductCounts(),
  ]);

  // Every active category, whether or not anything is filed under it yet —
  // the block is how a visitor sees what the shop carries, so it shouldn't
  // wait for the catalog to be sorted out.
  const categories = tree.map((node) => ({
    slug: node.slug,
    name: node.name[locale] || node.name.ru,
    imageUrl: node.imageUrl,
    count: categoryProductTotal(node, counts),
  }));

  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-[120rem] px-4 pt-6 sm:px-2">
        {/* The banner carries no text of its own; the heading stays for screen
            readers and search engines only. */}
        <h1 className="sr-only">{dict.home.heroTitle}</h1>
        <Hero />
      </section>

      {/* Categories with their photos come first, straight under the banner:
          they're how a visitor picks a part. The popular products follow.
          Clicking one opens everything filed under it, subcategories
          included. */}
      {categories.length > 0 && (
        <section className="mx-auto flex w-full max-w-[120rem] flex-col gap-4 px-2 py-8 sm:gap-6 sm:py-12">
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 sm:text-2xl dark:text-zinc-50">
            {dict.home.popularCategories}
          </h2>
          {/* Two across on a phone: the cards stay tappable and the block
              doesn't push the products off the first screen. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 min-[100rem]:grid-cols-6">
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/${locale}/catalog/category/${category.slug}`}
                className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
              >
                {/* object-contain, а не cover: фото деталей приходят в разных
                    пропорциях, и обрезка съедала бы края товара. Картинка
                    вписывается целиком, свободное место остаётся фоном. */}
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-zinc-100 p-2 dark:bg-zinc-800">
                  {category.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={category.imageUrl}
                      alt={category.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="px-3 text-center text-sm font-semibold text-zinc-400 dark:text-zinc-600">
                      {category.name}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 p-3 sm:gap-1 sm:p-4">
                  <span className="text-sm font-semibold text-zinc-900 sm:text-base dark:text-zinc-50">
                    {category.name}
                  </span>
                  <span className="text-xs text-zinc-500 sm:text-sm">
                    {dict.catalog.productCount(category.count)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {featured.length > 0 && (
        <section className="mx-auto flex w-full max-w-[120rem] flex-col gap-6 px-2 pb-12">
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
