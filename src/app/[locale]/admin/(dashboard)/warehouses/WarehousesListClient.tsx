"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteWarehouseAction } from "./actions";
import WarehouseFormModal, { type WarehouseFormValues } from "./WarehouseFormModal";
import type { WarehouseRow } from "./data";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

export default function WarehousesListClient({
  locale,
  dict,
  isAdmin,
  warehouses,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  isAdmin: boolean;
  warehouses: WarehouseRow[];
}) {
  const [modal, setModal] = useState<{ mode: "create" | "edit"; values?: WarehouseFormValues } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete(row: WarehouseRow) {
    if (!window.confirm(dict.confirmDeleteWarehouse)) return;
    startTransition(async () => {
      const result = await deleteWarehouseAction(locale, row.id, row.name);
      setDeleteError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {dict.warehousesTitle}
        </h1>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setModal({ mode: "create" })}
            className="rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
          >
            {dict.addWarehouse}
          </button>
        )}
      </div>

      {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

      {warehouses.length === 0 ? (
        <p className="py-16 text-center text-zinc-500">{dict.noResults}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {warehouses.map((w) => (
            <div
              key={w.id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <Link
                href={`/${locale}/admin/warehouses/${w.id}`}
                className="flex flex-col gap-0.5 hover:text-orange-600"
              >
                <span className="font-semibold text-zinc-900 dark:text-zinc-50">{w.name}</span>
                <span className="text-sm text-zinc-500">{w.address || "—"}</span>
                <span className="text-xs text-zinc-400">
                  {w.productCount} {dict.warehouseProductCountLabel}
                </span>
              </Link>

              {isAdmin && (
                <div className="mt-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModal({ mode: "edit", values: w })}
                    className="flex-1 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
                  >
                    {dict.actionEdit}
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleDelete(w)}
                    className="flex-1 rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:border-red-500 disabled:opacity-60 dark:border-red-900"
                  >
                    {dict.actionDelete}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {modal && (
        <WarehouseFormModal
          locale={locale}
          dict={dict}
          mode={modal.mode}
          initialValues={modal.values}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
