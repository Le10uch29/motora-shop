import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductBySlug, getAllProducts, categoryLabels, makeLabel, t } from "@/lib/products";
import { formatGel, formatUsd } from "@/lib/currency";
import { getBrandBySlug } from "@/lib/brands";
import { locales, isLocale } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import ProductGallery from "@/components/ProductGallery";
import BrandLogo from "@/components/BrandLogo";
import AddToCartButton from "@/components/AddToCartButton";

export async function generateStaticParams() {
  const products = await getAllProducts();
  return locales.flatMap((locale) =>
    products.map((product) => ({ locale, slug: product.slug }))
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/catalog/[slug]">): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const product = await getProductBySlug(slug);
  return { title: product ? `${t(product.name, locale)} — Araz Motors` : "Araz Motors" };
}

export default async function ProductPage({
  params,
}: PageProps<"/[locale]/catalog/[slug]">) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const dict = await getDictionary(locale);
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const brand = await getBrandBySlug(product.brand);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10">
      <nav className="text-sm text-zinc-500">
        <Link href={`/${locale}/catalog`} className="hover:text-orange-600">
          {dict.product.breadcrumbCatalog}
        </Link>
        {" / "}
        <Link
          href={`/${locale}/catalog?category=${product.category}`}
          className="hover:text-orange-600"
        >
          {t(categoryLabels[product.category], locale)}
        </Link>
        {" / "}
        <span className="text-zinc-700 dark:text-zinc-300">{t(product.name, locale)}</span>
      </nav>

      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2">
        <ProductGallery
          images={product.images}
          category={product.category}
          alt={t(product.name, locale)}
          overlay={
            <>
              <BrandLogo
                logoUrl={brand?.badgeLogoUrl}
                name={brand?.name ?? product.brand}
                className="absolute left-4 top-4"
              />
              {product.badge && (
                <span className="absolute bottom-4 right-4 rounded-full bg-black/80 px-3 py-1 text-xs font-medium text-white">
                  {t(product.badge, locale)}
                </span>
              )}
            </>
          }
        />

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-orange-600 dark:text-orange-500">
                {t(categoryLabels[product.category], locale)}
              </span>
              <span className="flex flex-wrap items-center gap-x-3 text-xs text-zinc-400">
                <span>
                  {dict.product.originCodeLabel}: {product.originCode ?? "—"}
                </span>
                <span>
                  {dict.product.productCodeLabel}: {product.productCode ?? "—"}
                </span>
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              {t(product.name, locale)}
            </h1>
          </div>

          <div className="flex flex-col gap-0.5">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
                {formatGel(product.price, locale)}
              </span>
              {product.oldPrice && (
                <span className="text-lg text-zinc-400 line-through">
                  {formatGel(product.oldPrice, locale)}
                </span>
              )}
            </div>
            <span className="text-zinc-500">{formatUsd(product.price, locale)}</span>
          </div>

          <p className="text-zinc-600 dark:text-zinc-400">{t(product.description, locale)}</p>

          <div className="flex items-center gap-3">
            <p
              className={
                product.stock > 0
                  ? "text-sm font-medium text-emerald-600"
                  : "text-sm font-medium text-zinc-500"
              }
            >
              {product.stock > 0 ? dict.product.inStock : dict.product.onOrder}
            </p>
            {product.stock > 0 && (
              <span className="text-sm text-zinc-500">{dict.product.stockCount(product.stock)}</span>
            )}
          </div>

          <AddToCartButton
            productId={product.id}
            inStock={product.stock > 0}
            stock={product.stock}
            labels={{
              addToCart: dict.product.addToCart,
              onOrder: dict.product.onOrder,
              added: dict.product.added,
              quantityLabel: dict.product.quantityLabel,
              quantityDecreaseAria: dict.product.quantityDecreaseAria,
              quantityIncreaseAria: dict.product.quantityIncreaseAria,
            }}
          />

          <dl className="grid grid-cols-3 gap-x-6 gap-y-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-zinc-500">
                {dict.product.makeLabel}
              </dt>
              <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {makeLabel(product.make, locale)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-zinc-500">
                {dict.product.modelLabel}
              </dt>
              <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {product.model || "—"}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-zinc-500">
                {dict.product.yearLabel}
              </dt>
              <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {product.yearFrom}–{product.yearTo}
              </dd>
            </div>
          </dl>

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-zinc-500">
                {dict.product.brandLabel}
              </dt>
              <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {brand?.name ?? product.brand}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-xs uppercase tracking-wide text-zinc-500">
                {dict.product.makeLabel}
              </dt>
              <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {makeLabel(product.make, locale)}
              </dd>
            </div>
            {product.specs.map((spec) => (
              <div key={t(spec.label, locale)} className="flex flex-col gap-0.5">
                <dt className="text-xs uppercase tracking-wide text-zinc-500">
                  {t(spec.label, locale)}
                </dt>
                <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {t(spec.value, locale)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </main>
  );
}
