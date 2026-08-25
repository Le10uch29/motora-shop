import Link from "next/link";
import { t, categoryLabels, discountPercent, type Product } from "@/lib/products";
import { formatGel, formatUsd } from "@/lib/currency";
import type { Locale } from "@/i18n/locales";
import type { Dictionary } from "@/i18n/dictionary";
import type { Brand } from "@/lib/brands";
import ProductVisual from "@/components/ProductVisual";
import BrandLogo from "@/components/BrandLogo";
import ProductCardAddToCart from "@/components/ProductCardAddToCart";

export default function ProductCard({
  product,
  locale,
  dict,
  brands = [],
}: {
  product: Product;
  locale: Locale;
  dict: Dictionary;
  brands?: Brand[];
}) {
  const brand = brands.find((b) => b.slug === product.brand);
  const percent = discountPercent(product);

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
      <Link href={`/${locale}/catalog/${product.slug}`} className="flex flex-1 flex-col">
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
          {product.stock <= 0 && (
            <span className="absolute right-3 top-3 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
              {dict.product.onOrder}
            </span>
          )}
          <BrandLogo
            logoUrl={brand?.badgeLogoUrl}
            name={brand?.name ?? product.brand}
            className="absolute left-3 top-3"
          />
          {product.badge && (
            <span className="absolute bottom-3 right-3 rounded-full bg-black/80 px-2.5 py-1 text-xs font-medium text-white">
              {t(product.badge, locale)}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4 pb-0">
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
              {percent !== undefined && (
                <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                  −{percent}%
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
      <div className="p-4 pt-3">
        {product.stock > 0 ? (
          <ProductCardAddToCart
            productId={product.id}
            stock={product.stock}
            labels={{
              addToCart: dict.product.addToCart,
              added: dict.product.added,
              quantityDecreaseAria: dict.product.quantityDecreaseAria,
              quantityIncreaseAria: dict.product.quantityIncreaseAria,
            }}
          />
        ) : (
          <span className="block rounded-full bg-zinc-100 px-3 py-1.5 text-center text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {dict.product.onOrder}
          </span>
        )}
      </div>
    </div>
  );
}
