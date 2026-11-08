"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import type { Locale } from "@/i18n/locales";
import type { Dictionary } from "@/i18n/dictionary";
import { exportStockCsvAction } from "./stockExportActions";
import {
  STOCK_EXPORT_OPTIONAL,
  STOCK_EXPORT_REQUIRED,
  type StockExportColumn,
  type StockExportScope,
} from "./stockExport";

/** Окно «Экспорт остатков»: какие товары, какой бренд, какие колонки. */
export default function StockExportModal({
  locale,
  dict,
  brands,
  initialBrandId,
  onClose,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  brands: { id: string; name: string }[];
  /** Бренд, выбранный сейчас в фильтре списка. */
  initialBrandId: string | null;
  onClose: () => void;
}) {
  const [scope, setScope] = useState<StockExportScope>("all");
  const [brandId, setBrandId] = useState(initialBrandId ?? "");
  const [optional, setOptional] = useState<Set<StockExportColumn>>(new Set(["status"]));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  useEscapeKey(onClose);

  const labels: Record<StockExportColumn, string> = {
    productCode: dict.productsColProductCode,
    originCode: dict.productsColOriginCode,
    name: dict.productsColName,
    brand: dict.productsColBrand,
    make: dict.stockExportColMake,
    model: dict.stockExportColModel,
    years: dict.stockExportColYears,
    stock: dict.productsColStock,
    status: dict.stockExportColStatus,
    price: dict.productsColPrice,
    oldPrice: dict.stockExportColOldPrice,
    photo: dict.stockExportColPhoto,
  };

  function toggle(column: StockExportColumn) {
    setOptional((prev) => {
      const next = new Set(prev);
      if (next.has(column)) next.delete(column);
      else next.add(column);
      return next;
    });
  }

  function download() {
    setMessage(null);
    startTransition(async () => {
      const result = await exportStockCsvAction(locale, {
        columns: Array.from(optional),
        scope,
        brandId: brandId || null,
      });
      if (!result.ok) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      if (result.count === 0) {
        setMessage({ ok: false, text: dict.stockExportEmpty });
        return;
      }
      const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setMessage({ ok: true, text: `${dict.stockExportDone} ${result.count}` });
    });
  }

  const selectClass =
    "rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-16">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-export-title"
        className="relative flex w-full max-w-lg flex-col gap-5 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h2 id="stock-export-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {dict.stockExportTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={dict.stockExportClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-zinc-500">{dict.stockExportHint}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.stockExportScope}
            <select value={scope} onChange={(e) => setScope(e.target.value as StockExportScope)} className={selectClass}>
              <option value="all">{dict.stockExportScopeAll}</option>
              <option value="in_stock">{dict.stockExportInStock}</option>
              <option value="out_of_stock">{dict.stockExportOutOfStock}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.brandFilterLabel}
            <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className={selectClass}>
              <option value="">{dict.brandFilterAll}</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.stockExportColumns}
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {STOCK_EXPORT_REQUIRED.map((column) => (
              <label key={column} className="flex items-center gap-2 text-sm text-zinc-500">
                <input type="checkbox" checked disabled className="h-4 w-4 rounded border-zinc-300" />
                {labels[column]} <span className="text-xs">({dict.stockExportRequired})</span>
              </label>
            ))}
            {STOCK_EXPORT_OPTIONAL.map((column) => (
              <label key={column} className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={optional.has(column)}
                  onChange={() => toggle(column)}
                  className="h-4 w-4 rounded border-zinc-300"
                />
                {labels[column]}
              </label>
            ))}
          </div>
        </fieldset>

        {message && (
          <p role="status" className={`text-sm ${message.ok ? "text-emerald-600" : "text-red-600"}`}>
            {message.text}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            {dict.stockExportClose}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={download}
            className="rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-60"
          >
            {pending ? dict.stockExportWorking : dict.stockExportDownload}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
