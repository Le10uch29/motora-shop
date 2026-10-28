"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getCustomerCartAction, type CustomerCartLine } from "./actions";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { formatGel } from "@/lib/currency";
import { productImageUrl } from "@/lib/productImageUrl";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

/**
 * Что лежит в корзине покупателя — только посмотреть. Полезно, когда
 * покупатель звонит: «я собрал корзину, оформите», — видно, что именно.
 * Отдельно — уже заказанное за последние 3 дня (список «Заказано» в его
 * корзине).
 */
export default function CustomerCartModal({
  locale,
  dict,
  customer,
  onClose,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  customer: { id: string; name: string };
  onClose: () => void;
}) {
  const [lines, setLines] = useState<CustomerCartLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEscapeKey(onClose);

  useEffect(() => {
    let cancelled = false;
    getCustomerCartAction(locale, customer.id)
      .then((result) => {
        if (cancelled) return;
        setError(result.error);
        setLines(result.lines);
      })
      // Запрос мог не дойти (сеть, истёкшая сессия) — тогда показываем
      // ошибку, а не бесконечное «Загружаем…».
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : String(reason));
        setLines([]);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, customer.id]);

  const active = (lines ?? []).filter((line) => !line.orderedAt);
  const ordered = (lines ?? []).filter((line) => line.orderedAt);
  const total = active.reduce((sum, line) => sum + line.price * line.quantity, 0);

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-16">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{dict.customerCartTitle}</h2>
            <span className="text-sm text-zinc-500">{customer.name}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={dict.close}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {error ? null : lines === null ? (
          <p className="py-6 text-center text-sm text-zinc-500">{dict.customerCartLoading}</p>
        ) : lines.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            {dict.customerCartEmpty}
          </p>
        ) : (
          <>
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {dict.customerCartActiveTitle} · {active.length}
              </h3>
              {active.length === 0 ? (
                <p className="text-sm text-zinc-500">{dict.customerCartEmpty}</p>
              ) : (
                <>
                  <CartLines lines={active} locale={locale} dict={dict} />
                  <p className="text-right text-sm text-zinc-600 dark:text-zinc-400">
                    {dict.orderForCustomerTotal}{" "}
                    <strong className="text-zinc-900 dark:text-zinc-50">{formatGel(total, locale)}</strong>
                  </p>
                </>
              )}
            </section>

            {ordered.length > 0 && (
              <section className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {dict.customerCartOrderedTitle} · {ordered.length}
                </h3>
                <CartLines lines={ordered} locale={locale} dict={dict} muted />
              </section>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

function CartLines({
  lines,
  locale,
  dict,
  muted = false,
}: {
  lines: CustomerCartLine[];
  locale: Locale;
  dict: Dictionary["admin"];
  muted?: boolean;
}) {
  return (
    <ul className="flex flex-col divide-y divide-zinc-100 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {lines.map((line) => (
        <li key={line.id} className={`flex items-center gap-3 px-3 py-2 ${muted ? "opacity-70" : ""}`}>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
            {line.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={productImageUrl(line.image, "thumb")} alt="" className="h-full w-full object-fill" loading="lazy" decoding="async" />
            ) : (
              <span className="text-xs text-zinc-400">—</span>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{line.name}</span>
            <span className="flex flex-wrap gap-x-2 text-xs text-zinc-400">
              {line.productCode && <span className="font-mono">{line.productCode}</span>}
              {line.orderNumber && (
                <span>
                  {dict.orderNumberLabel} №{line.orderNumber}
                </span>
              )}
              {line.orderedAt && <span>{new Date(line.orderedAt).toLocaleDateString(locale)}</span>}
              {!line.orderedAt && line.stock <= 0 && <span className="text-red-500">0</span>}
            </span>
          </div>
          <span className="shrink-0 text-sm tabular-nums text-zinc-600 dark:text-zinc-400">× {line.quantity}</span>
          <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
            {formatGel(line.price * line.quantity, locale)}
          </span>
        </li>
      ))}
    </ul>
  );
}
