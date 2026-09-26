"use client";
import { useEscapeKey } from "@/hooks/useEscapeKey";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { getProductsCompletenessAction, type ProductCompletenessRow } from "./actions";
import type { Locale } from "@/i18n/locales";
import type { Dictionary } from "@/i18n/dictionary";

type Filter = "all" | "price" | "originCode" | "productCode";

export default function MissingDataModal({
  locale,
  dict,
  onClose,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ProductCompletenessRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>("price");

  useEffect(() => {
    getProductsCompletenessAction(locale).then(setRows);
  }, [locale]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    switch (filter) {
      case "price":
        return rows.filter((r) => !r.price);
      case "originCode":
        return rows.filter((r) => !r.originCode.trim());
      case "productCode":
        return rows.filter((r) => !r.productCode.trim());
      default:
        return rows;
    }
  }, [rows, filter]);

  useEscapeKey(onClose);

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-16">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative flex w-full max-w-2xl flex-col gap-5 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {dict.missingDataModalTitle}
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

        <div className="flex items-center gap-2">
          <label htmlFor="missing-data-filter" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {dict.missingDataFilterLabel}
          </label>
          <select
            id="missing-data-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="price">{dict.missingDataFilterPrice}</option>
            <option value="originCode">{dict.missingDataFilterOriginCode}</option>
            <option value="productCode">{dict.missingDataFilterProductCode}</option>
            <option value="all">{dict.missingDataFilterAll}</option>
          </select>
        </div>

        {rows === null ? (
          <p className="text-sm text-zinc-500">{dict.missingDataLoading}</p>
        ) : (
          <>
            <p className="text-sm text-zinc-500">
              {dict.missingDataCountLabel} {filtered.length}
            </p>
            {filtered.length === 0 ? (
              <p className="text-sm text-zinc-500">{dict.missingDataEmpty}</p>
            ) : (
              <ul className="flex max-h-[55vh] flex-col divide-y divide-zinc-200 overflow-y-auto dark:divide-zinc-800">
                {filtered.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {row.displayName || row.productCode || "—"}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {dict.importFieldProductCode}: {row.productCode || "—"} ·{" "}
                        {dict.importFieldOriginCode}: {row.originCode || "—"} · {dict.importFieldPrice}:{" "}
                        {row.price || "—"}
                      </span>
                    </div>
                    <Link
                      href={`/${locale}/admin/products/${row.id}`}
                      className="shrink-0 text-sm font-medium text-orange-600 hover:underline"
                    >
                      {dict.actionDetails}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
