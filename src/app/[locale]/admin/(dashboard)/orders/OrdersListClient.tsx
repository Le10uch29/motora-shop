import Link from "next/link";
import type { ReactNode } from "react";
import type { OrderSummaryRow } from "./data";
import { orderStatusLabel, orderStatusClass } from "./statusStyles";
import OrderRowActions from "./OrderRowActions";
import { formatGel } from "@/lib/currency";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

/**
 * Список заказов — по одной строке на оформление.
 *
 * Раньше строка была на заказчика, и все его заказы сливались в одну: четыре
 * разных оформления выглядели как один заказ с четырьмя номерами. Теперь
 * единица списка — сам заказ, тот же, что видит покупатель в истории покупок.
 */
export default function OrdersListClient({
  locale,
  dict,
  isAdmin,
  orders,
  emptyMessage,
  searchSlot,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  isAdmin: boolean;
  orders: OrderSummaryRow[];
  emptyMessage: string;
  searchSlot?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {dict.ordersTitle}
      </h1>

      {searchSlot}

      {orders.length === 0 ? (
        <p className="py-16 text-center text-zinc-500">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium">{dict.orderNumberLabel}</th>
                <th className="px-4 py-3 font-medium">{dict.orderColumnWhen}</th>
                <th className="px-4 py-3 font-medium">{dict.orderColumnCustomer}</th>
                <th className="px-4 py-3 font-medium">{dict.tablePhone}</th>
                <th className="px-4 py-3 font-medium">{dict.orderColumnLines}</th>
                <th className="px-4 py-3 font-medium">{dict.orderColumnStatus}</th>
                <th className="px-4 py-3 font-medium">{dict.warehouseAssignedLabel}</th>
                <th className="px-4 py-3 font-medium">{dict.orderColumnTotalAmount}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {orders.map((row) => (
                <tr key={row.orderNumber}>
                  <td className="px-4 py-3">
                    <Link
                      href={`/${locale}/admin/orders/${row.orderNumber}`}
                      className="font-medium text-zinc-900 hover:text-orange-600 dark:text-zinc-50"
                    >
                      №{row.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">
                    {new Date(row.createdAt).toLocaleString(locale)}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{row.name}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.phone || "—"}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.lineCount}</td>
                  <td className="px-4 py-3">
                    {row.status ? (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusClass(row.status)}`}
                      >
                        {orderStatusLabel(row.status, dict)}
                      </span>
                    ) : (
                      // Статусы строк разошлись — обычно отменили часть позиций.
                      <span className="text-xs text-zinc-500">{dict.orderMixedStatuses}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {row.warehouseName ? (
                      <div className="flex flex-col">
                        <span className="font-medium text-zinc-900 dark:text-zinc-50">{row.warehouseName}</span>
                        {row.warehouseAddress && (
                          <span className="text-xs text-zinc-400">{row.warehouseAddress}</span>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                    {formatGel(row.totalAmount, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <OrderRowActions
                      locale={locale}
                      dict={dict}
                      orderNumber={row.orderNumber}
                      label={`№${row.orderNumber} — ${row.name}`}
                      isAdmin={isAdmin}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
