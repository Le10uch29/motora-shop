"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/context/ConfirmContext";
import { hideOrderHistoryAction } from "@/app/[locale]/(public)/cart/actions";
import type { OrderHistory as OrderHistoryData } from "@/lib/orderHistory";
import { formatGel } from "@/lib/currency";
import { productImageUrl } from "@/lib/productImageUrl";
import type { Locale } from "@/i18n/locales";
import type { Dictionary } from "@/i18n/dictionary";
import ProductVisual from "@/components/ProductVisual";

const STATUS_STYLE: Record<string, string> = {
  new: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  gathering: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  gathered: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  shipped: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  delivered: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  cancelled: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

function StatusBadge({ status, label }: { status: string | null; label: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        (status && STATUS_STYLE[status]) || "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
      }`}
    >
      {label}
    </span>
  );
}

/** История заказов покупателя под корзиной: список заказов, по «Подробнее» —
 * что именно в нём заказано; удалить из истории один заказ или все. */
export default function OrderHistory({
  locale,
  dict,
  history,
  statusLabels,
}: {
  locale: Locale;
  dict: Dictionary["cart"];
  history: OrderHistoryData;
  statusLabels: Record<string, string>;
}) {
  const [openNumber, setOpenNumber] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const confirm = useConfirm();
  const router = useRouter();

  const statusLabel = (status: string | null) =>
    status ? statusLabels[status] ?? status : dict.historyStatusMixed;

  async function handleDelete(orderNumber: number | null) {
    const ok = await confirm({
      message: orderNumber === null ? dict.historyConfirmDeleteAll : dict.historyConfirmDelete,
      details:
        orderNumber === null
          ? dict.historyDeleteNote
          : `${dict.orderNumberLabel}${orderNumber} · ${dict.historyDeleteNote}`,
      irreversible: false,
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await hideOrderHistoryAction(locale, orderNumber);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (orderNumber === null || orderNumber === openNumber) setOpenNumber(null);
      router.refresh();
    });
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-4 border-t border-zinc-200 px-2 pb-12 pt-6 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          {dict.historyTitle}
          {history.orders.length > 0 && (
            <span className="ml-2 text-base font-medium text-zinc-400">{history.orders.length}</span>
          )}
        </h2>
        {history.canDelete && history.orders.length > 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={() => handleDelete(null)}
            className="rounded-full border border-zinc-200 px-4 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:border-red-400 hover:text-red-600 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
          >
            {dict.historyDeleteAll}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {history.orders.length === 0 ? (
        <p className="text-sm text-zinc-500">{dict.historyEmpty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {history.orders.map((order) => {
            const open = openNumber === order.orderNumber;
            return (
              <li
                key={order.orderNumber}
                className="flex flex-col rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                  <button
                    type="button"
                    onClick={() => setOpenNumber(open ? null : order.orderNumber)}
                    aria-expanded={open}
                    className="flex min-w-0 flex-1 flex-col items-start gap-1 text-left"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                        {dict.orderNumberLabel}
                        {order.orderNumber}
                      </span>
                      <StatusBadge status={order.status} label={statusLabel(order.status)} />
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(order.createdAt).toLocaleString(locale)} · {dict.historyItems}:{" "}
                      {order.lines.length}
                    </span>
                  </button>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {formatGel(order.total, locale)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenNumber(open ? null : order.orderNumber)}
                    className="text-sm font-medium text-orange-600 hover:underline"
                  >
                    {open ? dict.historyCollapse : dict.historyDetails}
                  </button>
                  {history.canDelete && (
                    <button
                      type="button"
                      disabled={pending}
                      aria-label={dict.historyDelete}
                      title={dict.historyDelete}
                      onClick={() => handleDelete(order.orderNumber)}
                      className="text-zinc-400 transition-colors hover:text-red-600 disabled:opacity-60"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {open && (
                  <ul className="flex flex-col divide-y divide-zinc-100 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                    {order.lines.map((line) => {
                      const cancelled = line.status === "cancelled";
                      const thumb = line.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={productImageUrl(line.image, "thumb")}
                          alt=""
                          className="h-full w-full object-fill"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <ProductVisual className="h-full w-full" />
                      );
                      return (
                        <li
                          key={line.id}
                          className={`flex items-center gap-3 px-4 py-3 ${cancelled ? "opacity-60" : ""}`}
                        >
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                            {line.productSlug ? (
                              <Link href={`/${locale}/catalog/${line.productSlug}`}>{thumb}</Link>
                            ) : (
                              thumb
                            )}
                          </div>
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            {line.productSlug ? (
                              <Link
                                href={`/${locale}/catalog/${line.productSlug}`}
                                className={`truncate text-sm font-medium text-zinc-900 hover:text-orange-600 dark:text-zinc-50 ${
                                  cancelled ? "line-through" : ""
                                }`}
                              >
                                {line.productName}
                              </Link>
                            ) : (
                              <span
                                className={`truncate text-sm font-medium text-zinc-900 dark:text-zinc-50 ${
                                  cancelled ? "line-through" : ""
                                }`}
                              >
                                {line.productName}
                              </span>
                            )}
                            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
                              {line.productCode && (
                                <span className="font-mono">
                                  {dict.productCodeLabel}: {line.productCode}
                                </span>
                              )}
                              <span>
                                {line.quantity} × {formatGel(line.unitPrice, locale)}
                              </span>
                              {order.status === null && (
                                <StatusBadge status={line.status} label={statusLabel(line.status)} />
                              )}
                            </span>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            {formatGel(line.unitPrice * line.quantity, locale)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
