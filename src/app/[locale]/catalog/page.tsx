import Link from "next/link";
import { notFound } from "next/navigation";
import {
  categoryIds,
  categoryLabels,
  getProductsByCategory,
  t,
  type CategoryId,
} from "@/lib/products";
import { isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import ProductCard from "@/components/ProductCard";

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

  const { category: rawCategory } = await searchParams;
  const singleCategory = Array.isArray(rawCategory) ? rawCategory[0] : rawCategory;
  const category = isCategoryId(singleCategory) ? singleCategory : undefined;
  const items = getProductsByCategory(category);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {dict.catalog.title}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {dict.catalog.productCount(items.length)}
          {category ? dict.catalog.inCategory(t(categoryLabels[category], locale)) : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={`/${locale}/catalog`}
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
            href={`/${locale}/catalog?category=${c}`}
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

      {items.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} locale={locale} dict={dict} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-zinc-500">{dict.catalog.empty}</p>
      )}
    </main>
  );
}
