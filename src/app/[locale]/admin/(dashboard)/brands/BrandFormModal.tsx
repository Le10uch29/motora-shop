"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createBrandAction, updateBrandAction, type BrandActionState } from "./actions";
import type { Dictionary } from "@/i18n/dictionary";

export type BrandFormValues = {
  id: string;
  name: string;
  initials: string | null;
  logoUrl: string | null;
  badgeLogoUrl: string | null;
};

const initialState: BrandActionState = { error: null };

export default function BrandFormModal({
  locale,
  dict,
  mode,
  initialValues,
  onClose,
}: {
  locale: string;
  dict: Dictionary["admin"];
  mode: "create" | "edit";
  initialValues?: BrandFormValues;
  onClose: () => void;
}) {
  const action = mode === "create" ? createBrandAction : updateBrandAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted && !pending && !state.error) onClose();
  }, [submitted, pending, state.error, onClose]);

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-16">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <form
        action={formAction}
        onSubmit={() => setSubmitted(true)}
        className="relative flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {mode === "create" ? dict.addBrand : dict.editBrand}
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
          <label htmlFor="brand-name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.brandNameLabel}
          </label>
          <input
            id="brand-name"
            name="name"
            required
            defaultValue={initialValues?.name}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="brand-initials" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.brandInitialsLabel}
          </label>
          <input
            id="brand-initials"
            name="initials"
            defaultValue={initialValues?.initials ?? ""}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <span className="text-xs text-zinc-400">{dict.brandInitialsHint}</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="brand-logo" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.brandLogoLabel}
          </label>
          {initialValues?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={initialValues.logoUrl} alt="" className="h-14 w-14 rounded-lg object-contain" />
          )}
          <input
            id="brand-logo"
            name="logo"
            type="file"
            accept="image/*"
            className="text-sm text-zinc-600 dark:text-zinc-400"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="brand-badge" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.brandBadgeLogoLabel}
          </label>
          {initialValues?.badgeLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={initialValues.badgeLogoUrl} alt="" className="h-8 w-8 rounded-md object-contain" />
          )}
          <input
            id="brand-badge"
            name="badgeLogo"
            type="file"
            accept="image/*"
            className="text-sm text-zinc-600 dark:text-zinc-400"
          />
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
