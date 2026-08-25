"use client";

import { useState, useTransition, type ReactNode } from "react";
import { deleteProductAction } from "./actions";
import ProductFormModal, { type ProductFormValues } from "./ProductFormModal";
import ProductWarehousesModal from "./ProductWarehousesModal";
import { RowActionLink, RowActionButton, EyeIcon, PencilIcon, TrashIcon } from "@/components/admin/RowActions";
import type { AdminProductRow } from "./data";
import { formatGel } from "@/lib/currency";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

export default function ProductsListClient({
  locale,
  dict,
  isAdmin,
  rows,
  brands,
  warehouses,
  stockByProduct,
  searchSlot,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  isAdmin: boolean;
  rows: AdminProductRow[];
  brands: { id: string; name: string }[];
  warehouses: { id: string; name: string }[];
  stockByProduct: Record<string, Record<string, number>>;
  searchSlot?: ReactNode;
}) {
  const [modal, setModal] = useState<{ mode: "create" | "edit"; values?: ProductFormValues } | null>(null);
  const [warehouseModalRow, setWarehouseModalRow] = useState<AdminProductRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete(row: AdminProductRow) {
    if (!window.confirm(dict.confirmDeleteProduct)) return;
    startTransition(async () => {
      const result = await deleteProductAction(locale, row.id, row.displayName);
      setDeleteError(result.error);
    });
  }

  function openEdit(row: AdminProductRow) {
    setModal({
      mode: "edit",
      values: {
        id: row.id,
        slug: row.slug,
        category: row.category,
        brandId: row.brandId,
        make: row.make,
        model: row.model,
        yearFrom: row.yearFrom,
        yearTo: row.yearTo,
        price: row.price,
        oldPrice: row.oldPrice,
        stock: row.stock,
        originCode: row.originCode,
        productCode: row.productCode,
        name: row.name,
        description: row.description,
        badge: row.badge,
        images: row.images,
        isPopular: row.isPopular,
      },
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {dict.productsAdminTitle}
        </h1>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setModal({ mode: "create" })}
            className="rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
          >
            {dict.addProduct}
          </button>
        )}
      </div>

      {searchSlot}

      {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

      {rows.length === 0 ? (
        <p className="py-16 text-center text-zinc-500">{dict.noResults}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium">{dict.productsColName}</th>
                <th className="px-4 py-3 font-medium">{dict.productsColBrand}</th>
                <th className="px-4 py-3 font-medium">{dict.productsColPrice}</th>
                <th className="px-4 py-3 font-medium">{dict.productsColStock}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="flex items-center gap-3 px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      {row.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.images[0]} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </div>
                    {row.displayName}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.brandName}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {formatGel(row.price, locale)}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.stock}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <RowActionLink href={`/${locale}/admin/products/${row.id}`} label={dict.actionDetails}>
                        <EyeIcon />
                      </RowActionLink>
                      {isAdmin && (
                        <>
                          <RowActionButton
                            label={dict.productWarehousesButtonLabel}
                            onClick={() => setWarehouseModalRow(row)}
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="h-4 w-4"
                            >
                              <path d="M3 9.5 12 4l9 5.5" />
                              <path d="M5 10v9a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1v-9" />
                            </svg>
                          </RowActionButton>
                          <RowActionButton label={dict.actionEdit} onClick={() => openEdit(row)}>
                            <PencilIcon />
                          </RowActionButton>
                          <RowActionButton
                            label={dict.actionDelete}
                            disabled={pending}
                            danger
                            onClick={() => handleDelete(row)}
                          >
                            <TrashIcon />
                          </RowActionButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ProductFormModal
          locale={locale}
          dict={dict}
          mode={modal.mode}
          brands={brands}
          initialValues={modal.values}
          onClose={() => setModal(null)}
        />
      )}

      {warehouseModalRow && (
        <ProductWarehousesModal
          locale={locale}
          dict={dict}
          productId={warehouseModalRow.id}
          productName={warehouseModalRow.displayName}
          warehouses={warehouses}
          stock={stockByProduct[warehouseModalRow.id] ?? {}}
          onClose={() => setWarehouseModalRow(null)}
        />
      )}
    </div>
  );
}
