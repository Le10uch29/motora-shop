"use client";

import { useState, useTransition } from "react";
import { removeStockAction } from "../actions";
import AddStockModal from "./AddStockModal";
import type { WarehouseStockRow } from "../data";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

export default function WarehouseStockListClient({
  locale,
  dict,
  isAdmin,
  warehouseId,
  stock,
  products,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  isAdmin: boolean;
  warehouseId: string;
  stock: WarehouseStockRow[];
  products: { id: string; name: string }[];
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleRemove(productId: string) {
    startTransition(async () => {
      const result = await removeStockAction(locale, warehouseId, productId);
      setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {dict.warehouseProductsTitle}
        </h2>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
          >
            {dict.addProductToWarehouse}
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {stock.length === 0 ? (
        <p className="py-16 text-center text-zinc-500">{dict.warehouseEmptyProducts}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[500px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium">{dict.productsColName}</th>
                <th className="px-4 py-3 font-medium">{dict.tableQuantity}</th>
                {isAdmin && <th className="px-4 py-3 font-medium" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {stock.map((row) => (
                <tr key={row.productId}>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                    {row.productName}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.quantity}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => handleRemove(row.productId)}
                        className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:border-red-500 disabled:opacity-60 dark:border-red-900"
                      >
                        {dict.actionRemove}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <AddStockModal
          locale={locale}
          dict={dict}
          warehouseId={warehouseId}
          products={products}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
