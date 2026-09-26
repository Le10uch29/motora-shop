"use client";

import { useState, useTransition } from "react";
import CategoryFormModal from "./CategoryFormModal";
import DeleteCategoryModal from "./DeleteCategoryModal";
import { setCategoryActiveAction } from "./actions";
import { RowActionLink, RowActionButton, EyeIcon, PencilIcon, TrashIcon } from "@/components/admin/RowActions";
import type { Category } from "@/lib/categories";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

export type CategoryListItem = {
  category: Category;
  /** Products in this category — a top-level one counts its subcategories' too. */
  productCount: number;
  subcategoryCount: number;
};

/**
 * The list of categories, used at both levels: on /admin/categories it shows
 * the top-level ones, inside a category it shows its subcategories. The only
 * difference is `parent`, which decides where "create" files the new one and
 * where each row's "open" link goes.
 */
export default function CategoriesListClient({
  locale,
  dict,
  parent,
  items,
  allCategories,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  parent: Category | null;
  items: CategoryListItem[];
  /** Every category in the panel — the delete dialog offers these as the new
   * home for the products of the one being deleted. */
  allCategories: { id: string; parentId: string | null; label: string }[];
}) {
  const [formModal, setFormModal] = useState<{ mode: "create" | "edit"; category?: Category } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryListItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleActive(category: Category) {
    setError(null);
    startTransition(async () => {
      const result = await setCategoryActiveAction(locale, category.id, !category.isActive);
      setError(result.error);
    });
  }

  function hrefFor(category: Category): string {
    return parent
      ? `/${locale}/admin/categories/${parent.id}/${category.id}`
      : `/${locale}/admin/categories/${category.id}`;
  }

  /** Where a deleted category's products may go: anywhere but the category
   * itself and the subcategories that are about to go with it. */
  function moveTargetsFor(category: Category) {
    return allCategories
      .filter((option) => option.id !== category.id && option.parentId !== category.id)
      .map(({ id, label }) => ({ id, label }));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {parent ? parent.name[locale] || parent.name.ru : dict.categoriesTitle}
        </h1>
        <button
          type="button"
          onClick={() => setFormModal({ mode: "create" })}
          className="rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
        >
          {parent ? dict.addSubcategory : dict.addCategory}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {items.length === 0 ? (
        <p className="py-16 text-center text-zinc-500">{dict.categoryNoSubcategories}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map(({ category, productCount, subcategoryCount }) => (
            <li
              key={category.id}
              // На узком экране кнопки уезжают на свою строку, а не сжимают
              // название до нечитаемого обрывка.
              className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 sm:gap-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              {category.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={category.imageUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg bg-zinc-100 object-contain p-0.5 dark:bg-zinc-800"
                />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
              )}

              <div className="flex min-w-0 flex-1 basis-40 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {category.name[locale] || category.name.ru}
                  </span>
                  {category.isDefault && (
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                      {dict.categoryDefaultBadge}
                    </span>
                  )}
                  {!category.isActive && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950/60 dark:text-amber-500">
                      {dict.categoryInactiveBadge}
                    </span>
                  )}
                </div>
                <span className="text-sm text-zinc-500">
                  {!parent && `${dict.categorySubcategoriesLabel} ${subcategoryCount} · `}
                  {dict.categoryProductsLabel} {productCount}
                  {" · "}
                  <span className="text-zinc-400">/{category.slug}</span>
                </span>
              </div>

              <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
                {/* Hiding is one click from the list — it's the thing an admin
                    reaches for most often, and the edit form's "Активна"
                    checkbox does the same when the category is open anyway. */}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => toggleActive(category)}
                  title={dict.categoryHiddenHint}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60 ${
                    category.isActive
                      ? "border-zinc-200 text-zinc-600 hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
                      : "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-500"
                  }`}
                >
                  {category.isActive ? dict.categoryHideButton : dict.categoryShowButton}
                </button>
                <RowActionLink href={hrefFor(category)} label={dict.categoryOpen}>
                  <EyeIcon />
                </RowActionLink>
                <RowActionButton
                  label={parent ? dict.editSubcategory : dict.editCategory}
                  onClick={() => setFormModal({ mode: "edit", category })}
                >
                  <PencilIcon />
                </RowActionButton>
                <RowActionButton
                  label={dict.deleteCategoryConfirmButton}
                  danger
                  onClick={() => setDeleteTarget({ category, productCount, subcategoryCount })}
                >
                  <TrashIcon />
                </RowActionButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {formModal && (
        <CategoryFormModal
          locale={locale}
          dict={dict}
          mode={formModal.mode}
          parentId={formModal.mode === "edit" ? formModal.category?.parentId ?? null : parent?.id ?? null}
          initialValues={formModal.category}
          onClose={() => setFormModal(null)}
        />
      )}

      {deleteTarget && (
        <DeleteCategoryModal
          locale={locale}
          dict={dict}
          category={deleteTarget.category}
          productCount={deleteTarget.productCount}
          subcategoryCount={deleteTarget.subcategoryCount}
          moveTargets={moveTargetsFor(deleteTarget.category)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
