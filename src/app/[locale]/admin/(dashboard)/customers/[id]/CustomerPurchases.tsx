"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { formatGel } from "@/lib/currency";
import { orderStatusClass, orderStatusLabel } from "../../orders/statusStyles";
import type { PurchaseOrder } from "../data";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

const PER_PAGE = 10;

/**
 * Покупки клиента — по заказам, а не по отдельным позициям.
 *
 * Строка отвечает на вопрос «когда и на сколько он покупал», подробности
 * открываются по клику. Пагинация здесь своя, на состоянии: она листает
 * только эту секцию, не трогая адрес страницы и не перезагружая остальное —
 * заказы уже загружены вместе со страницей.
 */
export default function CustomerPurchases({
  locale,
  dict,
  orders,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  orders: PurchaseOrder[];
}) {
  const [page, setPage] = useState(1);
  const [opened, setOpened] = useState<PurchaseOrder | null>(null);

  useEscapeKey(() => setOpened(null), opened !== null);

  if (orders.length === 0) {
    return <p className="text-sm text-zinc-500">{dict.customerPurchaseHistoryEmpty}</p>;
  }

  const totalPages = Math.max(1, Math.ceil(orders.length / PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const visible = orders.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE);

  const dateOf = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeOf = (iso: string) =>
    new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {visible.map((order) => (
          <li key={order.orderNumber}>
            <button
              type="button"
              onClick={() => setOpened(order)}
              className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
            >
              <span className="w-24 shrink-0 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {dateOf(order.createdAt)}
              </span>
              <span className="min-w-0 flex-1 text-sm text-zinc-600 dark:text-zinc-400">
                {dict.orderNumberLabel} {order.orderNumber}
                <span className="text-zinc-400">
                  {" · "}
                  {dict.purchasePositionsLabel} {order.lines.length}
                </span>
              </span>
              {order.status ? (
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusClass(order.status)}`}
                >
                  {orderStatusLabel(order.status, dict)}
                </span>
              ) : (
                <span className="shrink-0 text-xs text-zinc-400">{dict.purchaseStatusMixed}</span>
              )}
              <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                {formatGel(order.total, locale)}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            disabled={safePage === 1}
            onClick={() => setPage(safePage - 1)}
            aria-label={dict.purchasePrevPage}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:border-orange-500 hover:text-orange-600 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
          >
            ←
          </button>
          <span className="text-sm tabular-nums text-zinc-500">
            {safePage} / {totalPages}
          </span>
          <button
            type="button"
            disabled={safePage === totalPages}
            onClick={() => setPage(safePage + 1)}
            aria-label={dict.purchaseNextPage}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 text-zinc-600 transition-colors hover:border-orange-500 hover:text-orange-600 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
          >
            →
          </button>
        </div>
      )}

      {opened &&
        createPortal(
          <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-3 py-6 sm:px-4 sm:py-16">
            <div className="absolute inset-0" onClick={() => setOpened(null)} aria-hidden="true" />
            <div className="relative flex w-full max-w-2xl flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                    {dict.orderDetailsTitle} · {dict.orderNumberLabel} {opened.orderNumber}
                  </h3>
                  <span className="text-sm text-zinc-500">
                    {dateOf(opened.createdAt)} {timeOf(opened.createdAt)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpened(null)}
                  aria-label={dict.cancel}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-zinc-500">
                    <tr>
                      <th className="pb-2 font-medium">{dict.orderColumnProduct}</th>
                      <th className="pb-2 font-medium">{dict.productProductCodeLabel}</th>
                      <th className="pb-2 font-medium">{dict.orderColumnQuantity}</th>
                      <th className="pb-2 font-medium">{dict.orderColumnUnitPrice}</th>
                      <th className="pb-2 font-medium">{dict.orderColumnLineTotal}</th>
                      <th className="pb-2 font-medium">{dict.orderColumnStatus}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {opened.lines.map((line) => (
                      <tr key={line.id}>
                        <td className="py-2.5 pr-3 font-medium text-zinc-900 dark:text-zinc-50">
                          {line.productName}
                        </td>
                        <td className="py-2.5 pr-3 text-zinc-500">{line.productCode || "—"}</td>
                        <td className="py-2.5 pr-3 tabular-nums text-zinc-600 dark:text-zinc-400">
                          {line.quantity}
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums text-zinc-600 dark:text-zinc-400">
                          {formatGel(line.unitPrice, locale)}
                        </td>
                        <td className="py-2.5 pr-3 font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
                          {formatGel(line.lineTotal, locale)}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusClass(line.status)}`}
                          >
                            {orderStatusLabel(line.status, dict)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="flex items-baseline justify-end gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                <span className="text-sm text-zinc-500">{dict.orderColumnTotalAmount}</span>
                <span className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                  {formatGel(opened.total, locale)}
                </span>
              </p>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
