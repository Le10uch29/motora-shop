import Link from "next/link";
import { t, categoryLabels, type Product } from "@/lib/products";
import { formatGel, formatUsd } from "@/lib/currency";
import type { Locale } from "@/i18n/locales";
import type { Dictionary } from "@/i18n/dictionary";
import ProductVisual from "@/components/ProductVisual";
import BrandLogo from "@/components/BrandLogo";

export default function ProductCard({
  product,
  locale,
  dict,
}: {
  product: Product;
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <Link
      href={`/${locale}/catalog/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="relative">
        {product.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.images[0]}
            alt={t(product.name, locale)}
            className="aspect-[4/3] w-full object-cover"
          />
        ) : (
          <ProductVisual category={product.category} className="aspect-[4/3] w-full" />
        )}
        {product.badge && (
          <span className="absolute left-3 top-3 rounded-full bg-black/80 px-2.5 py-1 text-xs font-medium text-white">
            {t(product.badge, locale)}
          </span>
        )}
        {product.stock <= 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
            {dict.product.onOrder}
          </span>
        )}
        <BrandLogo brand={product.brand} className="absolute bottom-3 left-3" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-orange-600 dark:text-orange-500">
            {t(categoryLabels[product.category], locale)}
          </span>
          <span className="text-xs text-zinc-400">{product.productCode ?? "—"}</span>
        </div>
        <h3 className="font-semibold text-zinc-900 group-hover:text-orange-600 dark:text-zinc-50">
          {t(product.name, locale)}
        </h3>
        <div className="mt-auto flex flex-col gap-0.5 pt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              {formatGel(product.price, locale)}
            </span>
            {product.oldPrice && (
              <span className="text-sm text-zinc-400 line-through">
                {formatGel(product.oldPrice, locale)}
              </span>
            )}
          </div>
          <span className="text-sm text-zinc-500">{formatUsd(product.price, locale)}</span>
          {product.stock > 0 && (
            <span className="text-xs text-zinc-400">{dict.product.stockCount(product.stock)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
