"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { deleteCategoryAction, type DeleteCategoryMode } from "./actions";
import type { Category } from "@/lib/categories";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

/**
 * Deleting a category always asks what happens to its products first — they
 * are never deleted along with it. Either the links are dropped (the products
 * keep existing with no category and show up under "Все товары") or they are
 * moved to another category.
 */
export default function DeleteCategoryModal({
  locale,
  dict,
  category,
  productCount,
  subcategoryCount,
  /** Every category that could take the products — the one being deleted and
   * its own subcategories are filtered out by the caller. */
  moveTargets,
  onClose,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  category: Category;
  productCount: number;
  subcategoryCount: number;
  moveTargets: { id: string; label: string }[];
  onClose: () => void;
}) {
  const [mode, setMode] = useState<DeleteCategoryMode>("uncategorize");
  const [targetId, setTargetId] = useState(moveTargets[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deleteCategoryAction(
        locale,
        category.id,
        category.name.ru,
        mode,
        mode === "move" ? targetId : undefined
      );
      if (result.error) setError(result.error);
      else onClose();
    });
  }

  const radioClass = "mt-0.5 h-4 w-4 shrink-0 border-zinc-300";

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-3 py-6 sm:px-4 sm:py-16">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{dict.deleteCategoryTitle}</h2>
        <p className="text-sm text-zinc-700 dark:text-zinc-300">{category.name.ru}</p>

        {subcategoryCount > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-500">
            {dict.deleteCategorySubcategoriesWarning} ({subcategoryCount})
          </p>
        )}

        {productCount > 0 ? (
          <>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {dict.categoryProductsLabel} {productCount}. {dict.deleteCategoryProductsQuestion}
            </p>
            <div className="flex flex-col gap-3">
              <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="radio"
                  name="delete-mode"
                  checked={mode === "uncategorize"}
                  onChange={() => setMode("uncategorize")}
                  className={radioClass}
                />
                {dict.deleteCategoryLeaveUncategorized}
              </label>
              <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="radio"
                  name="delete-mode"
                  checked={mode === "move"}
                  onChange={() => setMode("move")}
                  disabled={moveTargets.length === 0}
                  className={radioClass}
                />
                {dict.deleteCategoryMoveToLabel}
              </label>
              {mode === "move" && (
                <select
                  value={targetId}
                  onChange={(event) => setTargetId(event.target.value)}
                  className="ml-6 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                >
                  {moveTargets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-500">{dict.confirmDeleteCategory}</p>
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
            disabled={pending || (mode === "move" && !targetId)}
            onClick={handleDelete}
            className="flex-1 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
          >
            {dict.deleteCategoryConfirmButton}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
