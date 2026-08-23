"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { addStockAction, type AddStockState } from "../actions";
import type { Dictionary } from "@/i18n/dictionary";

const initialState: AddStockState = { error: null };

export default function AddStockModal({
  locale,
  dict,
  warehouseId,
  products,
  onClose,
}: {
  locale: string;
  dict: Dictionary["admin"];
  warehouseId: string;
  products: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState(addStockAction, initialState);
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
            {dict.addProductToWarehouse}
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
        <input type="hidden" name="warehouseId" value={warehouseId} />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="stock-product" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.warehouseSelectProductLabel}
          </label>
          <select
            id="stock-product"
            name="productId"
            required
            defaultValue=""
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="" disabled>
              —
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="stock-quantity" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.warehouseQuantityLabel}
          </label>
          <input
            id="stock-quantity"
            name="quantity"
            type="number"
            min="0"
            required
            defaultValue={1}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
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
            {dict.create}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
