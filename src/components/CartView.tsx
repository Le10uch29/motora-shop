"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useCart } from "@/context/CartContext";
import { placeOrderAction } from "@/app/[locale]/(public)/cart/actions";
import { t, type CartProductSummary } from "@/lib/products";
import { formatGel, formatUsd } from "@/lib/currency";
import type { Locale } from "@/i18n/locales";
import type { Dictionary } from "@/i18n/dictionary";
import ProductVisual from "@/components/ProductVisual";

const ORDER_ERROR_CODES = new Set(["empty_cart", "not_authenticated", "products_not_found"]);

// Known error codes get the friendly translated message; anything else is a
// raw DB error message, shown as-is so it's actually diagnosable.
function orderErrorText(code: string, dict: Dictionary["cart"]): string {
  return ORDER_ERROR_CODES.has(code) ? dict.orderError : code;
}

export default function CartView({
  locale,
  dict,
  products,
}: {
  locale: Locale;
  dict: Dictionary["cart"];
  products: CartProductSummary[];
}) {
  const { items, setQuantity, removeItem, clear, orderPlaced, markOrdered } = useCart();
  const [orderError, setOrderError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = items
    .map((item) => ({
      item,
      product: products.find((p) => p.id === item.productId),
    }))
    .filter(
      (row): row is { item: (typeof items)[number]; product: CartProductSummary } =>
        Boolean(row.product) && row.product!.stock > 0
    );

  const totalPrice = rows.reduce((sum, { item, product }) => sum + product.price * item.quantity, 0);

  // A product can sell out or get deleted after it was added to the cart —
  // drop it from the stored cart too, not just this render, so the header
  // badge and a fresh page load agree with what's actually orderable.
  useEffect(() => {
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product || product.stock <= 0) removeItem(item.productId);
    }
  }, [items, products, removeItem]);

  function handleCheckout() {
    setOrderError(null);
    startTransition(async () => {
      const result = await placeOrderAction(items);
      if (result.error) {
        setOrderError(orderErrorText(result.error, dict));
        return;
      }
      markOrdered();
    });
  }

  if (rows.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {dict.emptyTitle}
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">{dict.emptyText}</p>
        <Link
          href={`/${locale}/catalog`}
          className="rounded-full bg-orange-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
        >
          {dict.goToCatalog}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {dict.title}
      </h1>

      <ul className="flex flex-col gap-4">
        {rows.map(({ item, product }) => (
          <li
            key={item.productId}
            className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <Link href={`/${locale}/catalog/${product.slug}`} className="shrink-0">
              <ProductVisual category={product.category} className="h-20 w-20 rounded-lg" />
            </Link>
            <div className="flex flex-1 flex-col gap-1">
              <Link
                href={`/${locale}/catalog/${product.slug}`}
                className="font-semibold text-zinc-900 hover:text-orange-600 dark:text-zinc-50"
              >
                {t(product.name, locale)}
              </Link>
              <span className="text-sm text-zinc-500">
                {formatGel(product.price, locale)} · {formatUsd(product.price, locale)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={dict.decreaseAria}
                onClick={() => setQuantity(item.productId, item.quantity - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
              >
                −
              </button>
              <span className="w-6 text-center font-medium text-zinc-900 dark:text-zinc-50">
                {item.quantity}
              </span>
              <button
                type="button"
                aria-label={dict.increaseAria}
                onClick={() => setQuantity(item.productId, item.quantity + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
              >
                +
              </button>
            </div>
            <span className="w-28 text-right font-semibold text-zinc-900 dark:text-zinc-50">
              {formatGel(product.price * item.quantity, locale)}
            </span>
            <button
              type="button"
              aria-label={dict.removeAria}
              onClick={() => removeItem(item.productId)}
              className="text-zinc-400 transition-colors hover:text-red-600"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-col items-end gap-4 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <div className="flex items-baseline gap-3 text-lg">
          <span className="text-zinc-600 dark:text-zinc-400">{dict.total}</span>
          <span className="font-bold text-zinc-900 dark:text-zinc-50">
            {formatGel(totalPrice, locale)}
          </span>
          <span className="text-sm text-zinc-500">{formatUsd(totalPrice, locale)}</span>
        </div>
        {orderError && <p className="text-sm text-red-600">{orderError}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={clear}
            className="rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:border-red-400 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            {dict.clear}
          </button>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={pending || orderPlaced}
            className={
              orderPlaced
                ? "cursor-default rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white"
                : "rounded-full bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-60"
            }
          >
            {orderPlaced ? dict.orderPlaced : dict.checkout}
          </button>
        </div>
      </div>
    </main>
  );
}
