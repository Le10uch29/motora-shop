"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  createCategoryAction,
  updateCategoryAction,
  type CategoryActionState,
} from "./actions";
import FileDropField from "@/components/admin/FileDropField";
import type { Category } from "@/lib/categories";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

const initialState: CategoryActionState = { error: null };

function errorText(code: string | null, dict: Dictionary["admin"]): string | null {
  if (!code) return null;
  if (code === "slug_required") return dict.categorySlugRequired;
  if (code === "missing_fields") return dict.categorySlugRequired;
  return code;
}

export default function CategoryFormModal({
  locale,
  dict,
  mode,
  /** Set when creating a subcategory — the category it belongs to. */
  parentId,
  initialValues,
  onClose,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  mode: "create" | "edit";
  parentId: string | null;
  initialValues?: Category;
  onClose: () => void;
}) {
  const action = mode === "create" ? createCategoryAction : updateCategoryAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted && !pending && !state.error) onClose();
  }, [submitted, pending, state.error, onClose]);

  const inputClass =
    "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
  const labelClass = "text-sm font-medium text-zinc-700 dark:text-zinc-300";
  const isSubcategory = parentId !== null;

  const title =
    mode === "create"
      ? isSubcategory
        ? dict.addSubcategory
        : dict.addCategory
      : isSubcategory
        ? dict.editSubcategory
        : dict.editCategory;

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-16">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <form
        action={formAction}
        onSubmit={() => setSubmitted(true)}
        className="relative flex w-full max-w-2xl flex-col gap-5 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <input type="hidden" name="locale" value={locale} />
        {mode === "edit" && <input type="hidden" name="id" value={initialValues?.id} />}
        {parentId && <input type="hidden" name="parentId" value={parentId} />}

        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>{dict.categoryNameSectionLabel}</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input name="nameRu" required placeholder="RU" defaultValue={initialValues?.name.ru} className={inputClass} />
            <input name="nameAz" placeholder="AZ" defaultValue={initialValues?.name.az} className={inputClass} />
            <input name="nameKa" placeholder="KA" defaultValue={initialValues?.name.ka} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="category-slug" className={labelClass}>{dict.categorySlugLabel}</label>
            <input id="category-slug" name="slug" defaultValue={initialValues?.slug} className={inputClass} />
            <span className="text-xs text-zinc-400">{dict.categorySlugHint}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="category-sort" className={labelClass}>{dict.categorySortOrderLabel}</label>
            <input
              id="category-sort"
              name="sortOrder"
              type="number"
              defaultValue={initialValues?.sortOrder ?? 0}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>{dict.categoryImageLabel}</span>
          {initialValues?.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={initialValues.imageUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
          )}
          <FileDropField
            id="category-image"
            name="image"
            accept="image/*"
            buttonLabel={dict.fileDropButton}
            hint={dict.fileDropHint}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={initialValues ? initialValues.isActive : true}
            className="h-4 w-4 rounded border-zinc-300"
          />
          {dict.categoryActiveLabel}
        </label>

        <details className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.categorySeoSectionLabel}
          </summary>
          <div className="mt-3 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-zinc-500">{dict.categoryDescriptionLabel}</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <textarea name="descriptionRu" rows={2} placeholder="RU" defaultValue={initialValues?.description?.ru} className={inputClass} />
                <textarea name="descriptionAz" rows={2} placeholder="AZ" defaultValue={initialValues?.description?.az} className={inputClass} />
                <textarea name="descriptionKa" rows={2} placeholder="KA" defaultValue={initialValues?.description?.ka} className={inputClass} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-zinc-500">{dict.categoryMetaTitleLabel}</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <input name="metaTitleRu" placeholder="RU" defaultValue={initialValues?.metaTitle?.ru} className={inputClass} />
                <input name="metaTitleAz" placeholder="AZ" defaultValue={initialValues?.metaTitle?.az} className={inputClass} />
                <input name="metaTitleKa" placeholder="KA" defaultValue={initialValues?.metaTitle?.ka} className={inputClass} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-zinc-500">{dict.categoryMetaDescriptionLabel}</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <textarea name="metaDescriptionRu" rows={2} placeholder="RU" defaultValue={initialValues?.metaDescription?.ru} className={inputClass} />
                <textarea name="metaDescriptionAz" rows={2} placeholder="AZ" defaultValue={initialValues?.metaDescription?.az} className={inputClass} />
                <textarea name="metaDescriptionKa" rows={2} placeholder="KA" defaultValue={initialValues?.metaDescription?.ka} className={inputClass} />
              </div>
            </div>
          </div>
        </details>

        {state.error && <p className="text-sm text-red-600">{errorText(state.error, dict)}</p>}

        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            {dict.cancel}
          </button>
          <button
            type="submit"
            disabled={pending}
            className="flex-1 rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-60"
          >
            {mode === "create" ? dict.create : dict.save}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
