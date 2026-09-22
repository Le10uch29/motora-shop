"use client";

import { useState, useTransition, type ReactNode } from "react";
import {
  deleteProductAction,
  deleteProductsAction,
  deleteAllProductsAction,
  deleteZeroStockProductsAction,
} from "./actions";
import ProductFormModal, { type ProductFormValues } from "./ProductFormModal";
import ProductWarehousesModal from "./ProductWarehousesModal";
import ImportProductsModal from "./ImportProductsModal";
import ImportConflictsModal from "./ImportConflictsModal";
import MissingDataModal from "./MissingDataModal";
import { RowActionLink, RowActionButton, EyeIcon, PencilIcon, TrashIcon } from "@/components/admin/RowActions";
import type { AdminProductRow } from "./data";
import { formatGel } from "@/lib/currency";
import { productImageUrl } from "@/lib/productImageUrl";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

export default function ProductsListClient({
  locale,
  dict,
  isAdmin,
  rows,
  total,
  brands,
  warehouses,
  stockByProduct,
  zeroStockCount,
  searchSlot,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  isAdmin: boolean;
  rows: AdminProductRow[];
  total: number;
  brands: { id: string; name: string }[];
  warehouses: { id: string; name: string }[];
  stockByProduct: Record<string, Record<string, number>>;
  /** Products with nothing in stock, across the whole catalog (not just this page). */
  zeroStockCount: number;
  searchSlot?: ReactNode;
}) {
  const [modal, setModal] = useState<{ mode: "create" | "edit"; values?: ProductFormValues } | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [conflictsModalOpen, setConflictsModalOpen] = useState(false);
  const [missingDataModalOpen, setMissingDataModalOpen] = useState(false);
  const [warehouseModalRow, setWarehouseModalRow] = useState<AdminProductRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [stockSort, setStockSort] = useState<"none" | "desc" | "asc">("none");
  const [pending, startTransition] = useTransition();

  function handleStockHeaderClick() {
    setStockSort((prev) => (prev === "desc" ? "asc" : "desc"));
  }

  const displayRows =
    stockSort === "none"
      ? rows
      : [...rows].sort((a, b) => (stockSort === "desc" ? b.stock - a.stock : a.stock - b.stock));

  const allIds = rows.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDelete(row: AdminProductRow) {
    if (!window.confirm(dict.confirmDeleteProduct)) return;
    startTransition(async () => {
      const result = await deleteProductAction(locale, row.id, row.displayName);
      setDeleteError(result.error);
    });
  }

  function handleDeleteSelected() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(dict.confirmDeleteSelectedProducts)) return;
    const ids = Array.from(selectedIds);
    startTransition(async () => {
      const result = await deleteProductsAction(locale, ids);
      setDeleteError(result.error);
      setSelectedIds(new Set());
    });
  }

  function handleDeleteAll() {
    if (total === 0) return;
    if (!window.confirm(`${dict.confirmDeleteAllProducts}\n${dict.confirmDeleteAllProductsCountLabel} ${total}`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteAllProductsAction(locale);
      setDeleteError(result.error);
      setSelectedIds(new Set());
    });
  }

  function handleDeleteZeroStock() {
    if (zeroStockCount === 0) return;
    if (
      !window.confirm(
        `${dict.confirmDeleteZeroStockProducts}\n${dict.confirmDeleteAllProductsCountLabel} ${zeroStockCount}`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await deleteZeroStockProductsAction(locale);
      setDeleteError(result.error);
      setSelectedIds(new Set());
    });
  }

  function openEdit(row: AdminProductRow) {
    setModal({
      mode: "edit",
      values: {
        id: row.id,
        slug: row.slug,
        brandId: row.brandId,
        fitments: row.fitments,
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
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="rounded-full border border-orange-600 px-5 py-2 text-sm font-semibold text-orange-600 transition-colors hover:bg-orange-50 dark:hover:bg-orange-950/40"
            >
              {dict.importExcelButton}
            </button>
            <button
              type="button"
              onClick={() => setConflictsModalOpen(true)}
              className="rounded-full border border-amber-500 px-5 py-2 text-sm font-semibold text-amber-600 transition-colors hover:bg-amber-50 dark:hover:bg-amber-950/40"
            >
              {dict.importConflictsButton}
            </button>
            <button
              type="button"
              onClick={() => setMissingDataModalOpen(true)}
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
            >
              {dict.missingDataButton}
            </button>
            <button
              type="button"
              onClick={() => setModal({ mode: "create" })}
              className="rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
            >
              {dict.addProduct}
            </button>
          </div>
        )}
      </div>

      {isAdmin && total > 0 && (
        <div className="flex justify-end gap-2">
          {zeroStockCount > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={handleDeleteZeroStock}
              className="rounded-full border border-red-300 px-4 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:hover:bg-red-950/40"
            >
              {dict.deleteZeroStockProductsButton} ({zeroStockCount})
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={handleDeleteAll}
            className="rounded-full border border-red-300 px-4 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:hover:bg-red-950/40"
          >
            {dict.deleteAllProductsButton}
          </button>
        </div>
      )}

      {searchSlot}

      {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

      {isAdmin && selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 dark:border-orange-900 dark:bg-orange-950/40">
          <span className="text-sm text-zinc-700 dark:text-zinc-300">{selectedIds.size}</span>
          <button
            type="button"
            disabled={pending}
            onClick={handleDeleteSelected}
            className="rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
          >
            {dict.deleteSelectedButton}
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="py-16 text-center text-zinc-500">{dict.noResults}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                {isAdmin && (
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected;
                      }}
                      onChange={toggleAll}
                      aria-label={dict.selectAllProductsAriaLabel}
                      className="h-4 w-4 rounded border-zinc-300"
                    />
                  </th>
                )}
                <th className="px-4 py-3 font-medium">{dict.productsColPhoto}</th>
                <th className="px-4 py-3 font-medium">{dict.productsColProductCode}</th>
                <th className="px-4 py-3 font-medium">{dict.productsColOriginCode}</th>
                <th className="px-4 py-3 font-medium">{dict.productsColName}</th>
                <th className="px-4 py-3 font-medium">{dict.productsColBrand}</th>
                <th className="px-4 py-3 font-medium">{dict.productsColPrice}</th>
                <th className="px-4 py-3 font-medium">
                  <button
                    type="button"
                    onClick={handleStockHeaderClick}
                    className="flex items-center gap-1 uppercase tracking-wide text-zinc-500 hover:text-orange-600 dark:text-zinc-400"
                  >
                    {dict.productsColStock}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`h-3 w-3 shrink-0 transition-transform ${
                        stockSort === "asc" ? "rotate-180" : ""
                      } ${stockSort === "none" ? "opacity-40" : ""}`}
                    >
                      <path d="M12 5v14M12 19l-5-5M12 19l5-5" />
                    </svg>
                  </button>
                </th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {displayRows.map((row) => (
                <tr key={row.id}>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                        aria-label={dict.selectProductAriaLabel}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                      {row.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={productImageUrl(row.images[0], "thumb")} alt="" className="h-full w-full object-fill" />
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.productCode || "—"}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.originCode || "—"}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">{row.displayName}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{row.brandName}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {formatGel(row.price, locale)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-zinc-600 dark:text-zinc-400 ${
                        row.stock < 50
                          ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40"
                          : "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
                      }`}
                    >
                      {row.stock}
                    </span>
                  </td>
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

      {importModalOpen && (
        <ImportProductsModal
          locale={locale}
          dict={dict}
          brands={brands}
          warehouses={warehouses}
          onClose={() => setImportModalOpen(false)}
        />
      )}

      {conflictsModalOpen && (
        <ImportConflictsModal
          locale={locale}
          dict={dict}
          onClose={() => setConflictsModalOpen(false)}
        />
      )}

      {missingDataModalOpen && (
        <MissingDataModal
          locale={locale}
          dict={dict}
          onClose={() => setMissingDataModalOpen(false)}
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
