import type { ReactNode } from "react";
import type { OrdererRow } from "./data";
import { orderStatusLabel, orderStatusClass } from "./statusStyles";
import OrdererRowActions from "./OrdererRowActions";
import { formatGel } from "@/lib/currency";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

export default function OrderersListClient({
  locale,
  dict,
  isAdmin,
  orderers,
  emptyMessage,
  searchSlot,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  isAdmin: boolean;
  orderers: OrdererRow[];
  emptyMessage: string;
  searchSlot?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        {dict.ordersTitle}
      </h1>

      {searchSlot}

      {orderers.length === 0 ? (
        <p className="py-16 text-center text-zinc-500">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium">{dict.orderNumberLabel}</th>
                <th className="px-4 py-3 font-medium">{dict.orderColumnCustomer}</th>
                <th className="px-4 py-3 font-medium">{dict.orderColumnStatus}</th>
                <th className="px-4 py-3 font-medium">{dict.warehouseAssignedLabel}</th>
                <th className="px-4 py-3 font-medium">{dict.tablePhone}</th>
                <th className="px-4 py-3 font-medium">{dict.orderColumnTotalAmount}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {orderers.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-zinc-500">
                    {row.orderNumber != null ? `№${row.orderNumber}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{row.name}</td>
                  <td className="px-4 py-3">
                    {row.status ? (
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusClass(row.status)}`}
                      >
                        {row.statusTotal}/{row.statusCount} {orderStatusLabel(row.status, dict)}
                      </span>
                    ) : (
                      "—"
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
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.phone || "—"}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                    {formatGel(row.totalAmount, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <OrdererRowActions
                      locale={locale}
                      dict={dict}
                      customerId={row.id}
                      label={row.name}
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
