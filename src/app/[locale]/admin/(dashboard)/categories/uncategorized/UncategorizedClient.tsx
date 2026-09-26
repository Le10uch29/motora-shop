"use client";
import { useEscapeKey } from "@/hooks/useEscapeKey";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { addProductsToCategoryAction } from "../actions";
import type { CategoryOption } from "../options";
import type { CategoryProductRow } from "../data";
import { formatGel } from "@/lib/currency";
import { productImageUrl } from "@/lib/productImageUrl";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

/**
 * Products that belong to no category. They are not lost — the shop shows
 * them under "Все товары" like everything else — this page is just where an
 * admin files them, one by one or a screenful at a time.
 */
export default function UncategorizedClient({
  locale,
  dict,
  products,
  categoryOptions,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  products: CategoryProductRow[];
  categoryOptions: CategoryOption[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignOpen, setAssignOpen] = useState(false);
  const [nameSort, setNameSort] = useState<"none" | "asc" | "desc">("none");

  /** Клик по «Название» ставит товары с похожими названиями подряд — так
   * группу однотипных деталей видно целиком и можно отметить её одним
   * проходом. Сортировка идёт по загруженному списку: страница отдаёт все
   * товары без категории сразу, без пагинации. */
  const displayProducts =
    nameSort === "none"
      ? products
      : [...products].sort((a, b) => {
          const compared = a.displayName.localeCompare(b.displayName, locale);
          return nameSort === "asc" ? compared : -compared;
        });

  const allSelected = products.length > 0 && products.every((p) => selected.has(p.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (products.length === 0) {
    return <p className="py-16 text-center text-zinc-500">{dict.uncategorizedEmpty}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {dict.uncategorizedTitle} · {products.length}
        </h1>
        <button
          type="button"
          disabled={selected.size === 0}
          onClick={() => setAssignOpen(true)}
          className="rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-60"
        >
          {dict.assignCategoryButton}
          {selected.size > 0 ? ` (${selected.size})` : ""}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label={dict.selectAllProductsAriaLabel}
                  className="h-4 w-4 rounded border-zinc-300"
                />
              </th>
              <th className="px-4 py-3 font-medium">{dict.productsColPhoto}</th>
              <th className="px-4 py-3 font-medium">{dict.productProductCodeLabel}</th>
              <th className="px-4 py-3 font-medium">
                <button
                  type="button"
                  onClick={() => setNameSort((prev) => (prev === "asc" ? "desc" : "asc"))}
                  className="flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-orange-600"
                >
                  {dict.tableName}
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`h-3.5 w-3.5 ${
                      nameSort === "none" ? "opacity-40" : "text-orange-600"
                    } ${nameSort === "desc" ? "rotate-180" : ""}`}
                  >
                    <path d="M12 5v14M6 13l6 6 6-6" />
                  </svg>
                </button>
              </th>
              <th className="px-4 py-3 font-medium">{dict.productMakeLabel}</th>
              <th className="px-4 py-3 font-medium">{dict.productPriceLabel}</th>
              <th className="px-4 py-3 font-medium">{dict.productStockLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {displayProducts.map((product) => (
              <tr key={product.id}>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(product.id)}
                    onChange={() => toggleOne(product.id)}
                    aria-label={dict.selectProductAriaLabel}
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                </td>
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
                <td className="px-4 py-3 text-zinc-500">
                  {[product.make, product.model].filter(Boolean).join(" ")}
                </td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                  {formatGel(product.price, locale)}
                </td>
                <td className={`px-4 py-3 ${product.stock > 0 ? "text-zinc-700 dark:text-zinc-300" : "text-amber-600"}`}>
                  {product.stock}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {assignOpen && (
        <AssignCategoryModal
          locale={locale}
          dict={dict}
          productIds={Array.from(selected)}
          categoryOptions={categoryOptions}
          onDone={() => {
            setSelected(new Set());
            setAssignOpen(false);
          }}
          onClose={() => setAssignOpen(false)}
        />
      )}
    </div>
  );
}

function AssignCategoryModal({
  locale,
  dict,
  productIds,
  categoryOptions,
  onDone,
  onClose,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  productIds: string[];
  categoryOptions: CategoryOption[];
  onDone: () => void;
  onClose: () => void;
}) {
  const [targetId, setTargetId] = useState(categoryOptions[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleAssign() {
    setError(null);
    startTransition(async () => {
      const result = await addProductsToCategoryAction(locale, targetId, productIds);
      if (result.error) setError(result.error);
      else onDone();
    });
  }

  useEscapeKey(onClose);

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-3 py-6 sm:px-4 sm:py-16">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{dict.assignCategoryTitle}</h2>
        <p className="text-sm text-zinc-500">
          {dict.categoryProductsLabel} {productIds.length}
        </p>

        <select
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          {categoryOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

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
            onClick={handleAssign}
            className="flex-1 rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-60"
          >
            {dict.assignCategoryButton}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
