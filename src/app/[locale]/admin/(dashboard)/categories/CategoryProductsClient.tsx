"use client";
import { useEscapeKey } from "@/hooks/useEscapeKey";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  addProductsToCategoryAction,
  detachProductAction,
  moveProductAction,
  searchProductsForCategoryAction,
  type ProductSearchResult,
} from "./actions";
import type { CategoryOption } from "./options";
import type { CategoryProductRow } from "./data";
import { RowActionButton, XCircleIcon } from "@/components/admin/RowActions";
import { formatGel } from "@/lib/currency";
import { productImageUrl } from "@/lib/productImageUrl";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

const overlayClass =
  "fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-3 py-6 sm:px-4 sm:py-16";
const panelClass =
  "relative flex w-full max-w-2xl flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900";
const inputClass =
  "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

/**
 * The products of one subcategory, and the three things an admin does with
 * them: add one that already exists, move one somewhere else, or unlink it.
 *
 * None of these create or delete a product — only the link between a product
 * and a category ever changes.
 */
export default function CategoryProductsClient({
  locale,
  dict,
  categoryId,
  products,
  categoryOptions,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  categoryId: string;
  products: CategoryProductRow[];
  categoryOptions: CategoryOption[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<CategoryProductRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDetach(product: CategoryProductRow) {
    if (!window.confirm(dict.confirmDetachProduct)) return;
    setError(null);
    startTransition(async () => {
      const result = await detachProductAction(locale, product.id, categoryId);
      setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          {dict.categoryProductsTitle} · {products.length}
        </h2>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
        >
          {dict.addExistingProductButton}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {products.length === 0 ? (
        <p className="py-16 text-center text-zinc-500">{dict.noResults}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-3 font-medium">{dict.productsColPhoto}</th>
                <th className="px-4 py-3 font-medium">{dict.productProductCodeLabel}</th>
                <th className="px-4 py-3 font-medium">{dict.tableName}</th>
                <th className="px-4 py-3 font-medium">{dict.productMakeLabel}</th>
                <th className="px-4 py-3 font-medium">{dict.productModelLabel}</th>
                <th className="px-4 py-3 font-medium">{dict.productPriceLabel}</th>
                <th className="px-4 py-3 font-medium">{dict.productStockLabel}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {products.map((product) => (
                <tr key={product.id}>
                  <td className="px-4 py-3">
                    {product.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={productImageUrl(product.image, "thumb")}
                        alt=""
                        className="h-10 w-10 rounded-lg object-fill"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                    {product.productCode || "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{product.displayName}</td>
                  <td className="px-4 py-3 text-zinc-500">{product.make}</td>
                  <td className="px-4 py-3 text-zinc-500">{product.model || "—"}</td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {formatGel(product.price, locale)}
                  </td>
                  <td className={`px-4 py-3 ${product.stock > 0 ? "text-zinc-700 dark:text-zinc-300" : "text-amber-600"}`}>
                    {product.stock}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setMoveTarget(product)}
                        className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:border-orange-500 hover:text-orange-600 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        {dict.moveProductButton}
                      </button>
                      <RowActionButton
                        label={dict.detachProductButton}
                        danger
                        disabled={pending}
                        onClick={() => handleDetach(product)}
                      >
                        <XCircleIcon />
                      </RowActionButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {addOpen && (
        <AddExistingProductModal
          locale={locale}
          dict={dict}
          categoryId={categoryId}
          onClose={() => setAddOpen(false)}
        />
      )}

      {moveTarget && (
        <MoveProductModal
          locale={locale}
          dict={dict}
          product={moveTarget}
          fromCategoryId={categoryId}
          categoryOptions={categoryOptions.filter((option) => option.id !== categoryId)}
          onClose={() => setMoveTarget(null)}
        />
      )}
    </div>
  );
}

/** Finds a product that already exists and links it here — never creates one.
 * A product already in this category is shown but can't be picked again. */
function AddExistingProductModal({
  locale,
  dict,
  categoryId,
  onClose,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  categoryId: string;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function runSearch() {
    startTransition(async () => {
      const found = await searchProductsForCategoryAction(locale, categoryId, query);
      setResults(found);
      setSearched(true);
    });
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleAdd() {
    if (selected.size === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await addProductsToCategoryAction(locale, categoryId, Array.from(selected));
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  useEscapeKey(onClose);

  return createPortal(
    <div className={overlayClass}>
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className={panelClass}>
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{dict.addExistingProductTitle}</h2>

        <div className="flex items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                runSearch();
              }
            }}
            placeholder={dict.addExistingProductSearchPlaceholder}
            className={`flex-1 ${inputClass}`}
          />
          <button
            type="button"
            disabled={pending || query.trim().length < 2}
            onClick={runSearch}
            className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
          >
            {dict.searchPlaceholder}
          </button>
        </div>

        {searched && results.length === 0 && (
          <p className="py-6 text-center text-sm text-zinc-500">{dict.addExistingProductEmpty}</p>
        )}

        {results.length > 0 && (
          <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {results.map((product) => (
              <li key={product.id}>
                <label
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                    product.alreadyInCategory
                      ? "text-zinc-400"
                      : "cursor-pointer text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={product.alreadyInCategory}
                    checked={selected.has(product.id)}
                    onChange={() => toggle(product.id)}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                  <span className="font-medium">{product.productCode || "—"}</span>
                  <span className="min-w-0 flex-1 truncate">{product.displayName}</span>
                  <span className="shrink-0 text-xs text-zinc-400">
                    {product.alreadyInCategory
                      ? dict.addExistingProductAlreadyHere
                      : [product.make, product.model].filter(Boolean).join(" ")}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            {dict.cancel}
          </button>
          <button
            type="button"
            disabled={pending || selected.size === 0}
            onClick={handleAdd}
            className="flex-1 rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-60"
          >
            {dict.addToCategoryButton}
            {selected.size > 0 ? ` (${selected.size})` : ""}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function MoveProductModal({
  locale,
  dict,
  product,
  fromCategoryId,
  categoryOptions,
  onClose,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  product: CategoryProductRow;
  fromCategoryId: string;
  categoryOptions: CategoryOption[];
  onClose: () => void;
}) {
  const [targetId, setTargetId] = useState(categoryOptions[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleMove() {
    setError(null);
    startTransition(async () => {
      const result = await moveProductAction(locale, product.id, fromCategoryId, targetId);
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  useEscapeKey(onClose);

  return createPortal(
    <div className={overlayClass}>
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{dict.moveProductTitle}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {product.productCode} · {product.displayName}
        </p>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="move-target" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.moveProductTargetLabel}
          </label>
          <select
            id="move-target"
            value={targetId}
            onChange={(event) => setTargetId(event.target.value)}
            className={inputClass}
          >
            {categoryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            {dict.cancel}
          </button>
          <button
            type="button"
            disabled={pending || !targetId}
            onClick={handleMove}
            className="flex-1 rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-60"
          >
            {dict.moveProductButton}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
