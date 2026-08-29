"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  getImportConflictsAction,
  resolveImportConflictAction,
  type ImportConflictRow,
} from "./actions";
import type { Locale } from "@/i18n/locales";
import type { Dictionary } from "@/i18n/dictionary";

export default function ImportConflictsModal({
  locale,
  dict,
  onClose,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  onClose: () => void;
}) {
  const [rows, setRows] = useState<ImportConflictRow[] | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    getImportConflictsAction(locale).then(setRows);
  }, [locale]);

  function handleResolve(id: string) {
    setPendingId(id);
    startTransition(async () => {
      await resolveImportConflictAction(locale, id);
      setRows((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
      setPendingId(null);
    });
  }

  function fieldLabel(field: string): string {
    return field === "price" ? dict.importFieldPrice : field;
  }

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-16">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative flex w-full max-w-2xl flex-col gap-5 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {dict.importConflictsModalTitle}
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

        {rows === null ? (
          <p className="text-sm text-zinc-500">{dict.importConflictsLoading}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-500">{dict.importConflictsEmpty}</p>
        ) : (
          <ul className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {row.productName ?? row.productCode}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {dict.importFieldProductCode}: {row.productCode}
                      {row.originCode ? ` · ${dict.importFieldOriginCode}: ${row.originCode}` : ""}
                    </span>
                  </div>
                  {row.productSlug && (
                    <Link
                      href={`/${locale}/admin/products/${row.productId}`}
                      className="shrink-0 text-sm font-medium text-orange-600 hover:underline"
                    >
                      {dict.actionDetails}
                    </Link>
                  )}
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {fieldLabel(row.field)}: {row.values.join(" / ")} → {dict.importConflictsKeptLabel}{" "}
                  <strong>{row.resolvedValue}</strong>
                </p>
                <button
                  type="button"
                  disabled={pendingId === row.id}
                  onClick={() => handleResolve(row.id)}
                  className="w-fit rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
                >
                  {dict.importConflictsResolveButton}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body
  );
}
