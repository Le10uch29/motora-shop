"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createProductAction, updateProductAction, type ProductActionState } from "./actions";
import { categoryIds, categoryLabels, t, type LocalizedText } from "@/lib/products";
import type { Locale } from "@/i18n/locales";
import type { Dictionary } from "@/i18n/dictionary";

export type ProductFormValues = {
  id: string;
  slug: string;
  category: string;
  brandId: string;
  make: string;
  model: string;
  yearFrom: number;
  yearTo: number;
  price: number;
  oldPrice: number | null;
  stock: number;
  originCode: string;
  productCode: string;
  name: LocalizedText;
  description: LocalizedText;
  badge: LocalizedText | null;
  images: string[];
};

const initialState: ProductActionState = { error: null };

export default function ProductFormModal({
  locale,
  dict,
  mode,
  brands,
  initialValues,
  onClose,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  mode: "create" | "edit";
  brands: { id: string; name: string }[];
  initialValues?: ProductFormValues;
  onClose: () => void;
}) {
  const action = mode === "create" ? createProductAction : updateProductAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted && !pending && !state.error) onClose();
  }, [submitted, pending, state.error, onClose]);

  const inputClass =
    "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
  const labelClass = "text-sm font-medium text-zinc-700 dark:text-zinc-300";

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-16">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <form
        action={formAction}
        onSubmit={() => setSubmitted(true)}
        className="relative flex w-full max-w-3xl flex-col gap-5 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {mode === "create" ? dict.addProduct : dict.editProduct}
          </h2>
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

        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>{dict.productNameSectionLabel}</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input name="nameRu" required placeholder="RU" defaultValue={initialValues?.name.ru} className={inputClass} />
            <input name="nameAz" required placeholder="AZ" defaultValue={initialValues?.name.az} className={inputClass} />
            <input name="nameKa" required placeholder="KA" defaultValue={initialValues?.name.ka} className={inputClass} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>{dict.productDescriptionSectionLabel}</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <textarea name="descriptionRu" required placeholder="RU" defaultValue={initialValues?.description.ru} rows={3} className={inputClass} />
            <textarea name="descriptionAz" required placeholder="AZ" defaultValue={initialValues?.description.az} rows={3} className={inputClass} />
            <textarea name="descriptionKa" required placeholder="KA" defaultValue={initialValues?.description.ka} rows={3} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="product-slug" className={labelClass}>{dict.productSlugLabel}</label>
            <input id="product-slug" name="slug" required defaultValue={initialValues?.slug} className={inputClass} />
            <span className="text-xs text-zinc-400">{dict.productSlugHint}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="product-category" className={labelClass}>{dict.productCategoryLabel}</label>
            <select
              id="product-category"
              name="category"
              required
              defaultValue={initialValues?.category ?? categoryIds[0]}
              className={inputClass}
            >
              {categoryIds.map((c) => (
                <option key={c} value={c}>
                  {t(categoryLabels[c], locale)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="product-brand" className={labelClass}>{dict.productBrandLabel}</label>
            <select
              id="product-brand"
              name="brandId"
              required
              defaultValue={initialValues?.brandId}
              className={inputClass}
            >
              <option value="" disabled>
                —
              </option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="product-make" className={labelClass}>{dict.productMakeLabel}</label>
            <input id="product-make" name="make" required defaultValue={initialValues?.make} className={inputClass} />
            <span className="text-xs text-zinc-400">{dict.productMakeHint}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="product-model" className={labelClass}>{dict.productModelLabel}</label>
            <input id="product-model" name="model" defaultValue={initialValues?.model} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="product-year-from" className={labelClass}>{dict.productYearFromLabel}</label>
              <input
                id="product-year-from"
                name="yearFrom"
                type="number"
                required
                defaultValue={initialValues?.yearFrom}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="product-year-to" className={labelClass}>{dict.productYearToLabel}</label>
              <input
                id="product-year-to"
                name="yearTo"
                type="number"
                required
                defaultValue={initialValues?.yearTo}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="product-price" className={labelClass}>{dict.productPriceLabel}</label>
            <input
              id="product-price"
              name="price"
              type="number"
              step="0.01"
              required
              defaultValue={initialValues?.price}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="product-old-price" className={labelClass}>{dict.productOldPriceLabel}</label>
            <input
              id="product-old-price"
              name="oldPrice"
              type="number"
              step="0.01"
              defaultValue={initialValues?.oldPrice ?? undefined}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="product-stock" className={labelClass}>{dict.productStockLabel}</label>
            <input
              id="product-stock"
              name="stock"
              type="number"
              defaultValue={initialValues?.stock ?? 0}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="product-origin-code" className={labelClass}>{dict.productOriginCodeLabel}</label>
            <input id="product-origin-code" name="originCode" defaultValue={initialValues?.originCode} className={inputClass} />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="product-product-code" className={labelClass}>{dict.productProductCodeLabel}</label>
            <input id="product-product-code" name="productCode" defaultValue={initialValues?.productCode} className={inputClass} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>{dict.productBadgeSectionLabel}</span>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input name="badgeRu" placeholder="RU" defaultValue={initialValues?.badge?.ru} className={inputClass} />
            <input name="badgeAz" placeholder="AZ" defaultValue={initialValues?.badge?.az} className={inputClass} />
            <input name="badgeKa" placeholder="KA" defaultValue={initialValues?.badge?.ka} className={inputClass} />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="product-images" className={labelClass}>{dict.productImagesLabel}</label>
          {initialValues && initialValues.images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {initialValues.images.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
              ))}
            </div>
          )}
          <input
            id="product-images"
            name="images"
            type="file"
            accept="image/*"
            multiple
            className="text-sm text-zinc-600 dark:text-zinc-400"
          />
          <span className="text-xs text-zinc-400">{dict.productImagesHint}</span>
        </div>

        {state.error && <p className="text-sm text-red-600">{state.error}</p>}

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
