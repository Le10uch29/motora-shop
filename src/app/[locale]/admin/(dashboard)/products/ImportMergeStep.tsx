"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useConfirm } from "@/context/ConfirmContext";
import { applyImportMergeAction } from "./importActions";
import {
  decisionForAll,
  MERGE_FIELDS,
  type ImportPendingUpdate,
  type MergeDecision,
  type MergeField,
  type StockMode,
} from "./importMerge";
import type { ImportRow } from "./importRows";
import { productImageUrl } from "@/lib/productImageUrl";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

type Props = {
  locale: Locale;
  dict: Dictionary["admin"];
  pending: ImportPendingUpdate[];
  runId: string | null;
  brandId: string;
  warehouseId: string;
  rows: ImportRow[];
};

/**
 * Шаг после импорта: товары, которые уже есть и в файле отличаются.
 * «Заменить» — данные из файла вместо имеющихся; «прибавить» (только остаток)
 * — количество из файла к имеющемуся. Ко всем сразу или по выбранным товарам
 * и полям.
 */
export default function ImportMergeStep(props: Props) {
  const { locale, dict, pending, runId, brandId, warehouseId, rows } = props;
  const confirm = useConfirm();
  const [stockMode, setStockMode] = useState<StockMode>("replace");
  const [selecting, setSelecting] = useState(false);
  const [done, setDone] = useState<{ updated: number; stock: number; skipped: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, startTransition] = useTransition();

  const withStock = pending.filter((item) => item.fileStock != null).length;

  function apply(decisions: MergeDecision[]) {
    setError(null);
    startTransition(async () => {
      const result = await applyImportMergeAction(locale, runId, brandId, rows, warehouseId || undefined, decisions);
      if (result.error === "already_merged") {
        setError(dict.importMergeAlreadyApplied);
        return;
      }
      if (result.error && result.updated === 0) {
        setError(result.error);
        return;
      }
      if (result.error) setError(result.error);
      setSelecting(false);
      setDone({ updated: result.updated, stock: result.warehouseStockSet, skipped: false });
    });
  }

  async function applyAll() {
    const ok = await confirm({
      title: dict.importMergeTitle,
      message: `${dict.importMergeConfirmAll} ${pending.length}`,
      details: `${dict.importMergeStockLabel} ${stockModeLabel(stockMode, dict)}`,
      confirmLabel: dict.importMergeApply,
      tone: "default",
      irreversible: false,
    });
    if (ok) apply(decisionForAll(pending, stockMode));
  }

  if (done) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        {done.skipped
          ? dict.importMergeSkippedDone
          : `${dict.importMergeDone} ${done.updated}${done.stock > 0 ? ` · ${dict.importWarehouseStockSetLabel} ${done.stock}` : ""}`}
        {error && <p className="mt-1 text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
      <div>
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {dict.importMergeTitle}: {pending.length}
        </p>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{dict.importMergeHint}</p>
      </div>

      {withStock > 0 && (
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-800 dark:text-zinc-200">
          <legend className="mb-1 text-xs font-medium text-zinc-500">{dict.importMergeStockLabel}</legend>
          {(["replace", "add", "skip"] as const).map((mode) => (
            <label key={mode} className="flex items-center gap-1.5">
              <input
                type="radio"
                name="merge-stock-mode"
                checked={stockMode === mode}
                onChange={() => setStockMode(mode)}
              />
              {stockModeLabel(mode, dict)}
            </label>
          ))}
        </fieldset>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pendingAction}
          onClick={applyAll}
          className="rounded-full bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-60"
        >
          {pendingAction ? dict.importMergeWorking : dict.importMergeApplyAll}
        </button>
        <button
          type="button"
          disabled={pendingAction}
          onClick={() => setSelecting(true)}
          className="rounded-full border border-orange-600 px-4 py-2 text-sm font-semibold text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-60 dark:hover:bg-orange-950/40"
        >
          {dict.importMergeChoose}
        </button>
        <button
          type="button"
          disabled={pendingAction}
          onClick={() => setDone({ updated: 0, stock: 0, skipped: true })}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
        >
          {dict.importMergeLeave}
        </button>
      </div>

      {selecting && (
        <MergeSelectModal
          dict={dict}
          pending={pending}
          initialStockMode={stockMode}
          working={pendingAction}
          error={error}
          onClose={() => setSelecting(false)}
          onApply={apply}
        />
      )}
    </div>
  );
}

function stockModeLabel(mode: StockMode, dict: Dictionary["admin"]): string {
  return mode === "replace"
    ? dict.importMergeStockReplace
    : mode === "add"
    ? dict.importMergeStockAdd
    : dict.importMergeStockSkip;
}

function fieldLabel(field: MergeField, dict: Dictionary["admin"]): string {
  switch (field) {
    case "price":
      return dict.importFieldPrice;
    case "stock":
      return dict.importFieldStock;
    case "photo":
      return dict.importFieldPhoto;
    case "name":
      return dict.importFieldName;
    case "originCode":
      return dict.importFieldOriginCode;
    case "vehicles":
      return dict.importMergeFieldVehicles;
    case "description":
      return dict.importFieldDescription;
  }
}

type ItemChoice = { selected: boolean; fields: Set<MergeField>; stockMode: StockMode };

function MergeSelectModal({
  dict,
  pending,
  initialStockMode,
  working,
  error,
  onClose,
  onApply,
}: {
  dict: Dictionary["admin"];
  pending: ImportPendingUpdate[];
  initialStockMode: StockMode;
  working: boolean;
  error: string | null;
  onClose: () => void;
  onApply: (decisions: MergeDecision[]) => void;
}) {
  useEscapeKey(onClose);
  const [search, setSearch] = useState("");
  // По умолчанию: товар не выбран, но если выбрать — заменяются все его
  // отличающиеся поля, а остаток — как выбрано в шаге.
  const [choices, setChoices] = useState<Map<string, ItemChoice>>(
    () =>
      new Map(
        pending.map((item) => [
          item.code,
          {
            selected: false,
            fields: new Set(item.changes.map((change) => change.field).filter((field) => field !== "stock")),
            stockMode: item.fileStock != null ? initialStockMode : "skip",
          },
        ])
      )
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return pending;
    return pending.filter((item) => `${item.code} ${item.name}`.toLowerCase().includes(needle));
  }, [pending, search]);

  const selectedCount = [...choices.values()].filter((choice) => choice.selected).length;
  const allVisibleSelected = visible.length > 0 && visible.every((item) => choices.get(item.code)?.selected);

  function update(code: string, change: (choice: ItemChoice) => ItemChoice) {
    setChoices((prev) => {
      const next = new Map(prev);
      next.set(code, change(prev.get(code)!));
      return next;
    });
  }

  function toggleVisible() {
    setChoices((prev) => {
      const next = new Map(prev);
      for (const item of visible) next.set(item.code, { ...prev.get(item.code)!, selected: !allVisibleSelected });
      return next;
    });
  }

  function submit() {
    const decisions: MergeDecision[] = [];
    for (const item of pending) {
      const choice = choices.get(item.code)!;
      if (!choice.selected) continue;
      decisions.push({
        code: item.code,
        fields: MERGE_FIELDS.filter((field) => choice.fields.has(field)),
        stockMode: choice.stockMode,
      });
    }
    if (decisions.length > 0) onApply(decisions);
  }

  const inputClass =
    "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-select-title"
        className="relative flex w-full max-w-4xl flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h2 id="merge-select-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {dict.importMergeSelectTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={dict.cancel}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <p className="text-sm text-zinc-500">{dict.importMergeSelectHint}</p>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={dict.searchPlaceholder}
            className={`${inputClass} min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={toggleVisible}
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            {allVisibleSelected ? dict.returnClearAll : dict.returnSelectAll}
          </button>
        </div>

        <ul className="flex max-h-[60vh] flex-col divide-y divide-zinc-200 overflow-y-auto rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {visible.map((item) => {
            const choice = choices.get(item.code)!;
            const stockChange = item.changes.find((change) => change.field === "stock");
            return (
              <li key={item.code} className={`flex flex-col gap-2 px-3 py-3 ${choice.selected ? "" : "opacity-70"}`}>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={choice.selected}
                    onChange={(e) => update(item.code, (c) => ({ ...c, selected: e.target.checked }))}
                    className="h-4 w-4 shrink-0 rounded border-zinc-300"
                  />
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={productImageUrl(item.image, "thumb")} alt="" className="h-10 w-10 shrink-0 rounded-lg object-fill" loading="lazy" />
                  ) : (
                    <div className="h-10 w-10 shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                  )}
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{item.name}</span>
                    <span className="text-xs text-zinc-500">{item.code}</span>
                  </span>
                </label>

                <div className="ml-7 flex flex-col gap-1.5">
                  {item.changes
                    .filter((change) => change.field !== "stock")
                    .map((change) => (
                      <label key={change.field} className="flex flex-wrap items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          disabled={!choice.selected}
                          checked={choice.fields.has(change.field)}
                          onChange={(e) =>
                            update(item.code, (c) => {
                              const fields = new Set(c.fields);
                              if (e.target.checked) fields.add(change.field);
                              else fields.delete(change.field);
                              return { ...c, fields };
                            })
                          }
                          className="h-3.5 w-3.5 rounded border-zinc-300"
                        />
                        <span className="font-medium">{fieldLabel(change.field, dict)}:</span>
                        {change.field === "photo" ? (
                          <span className="flex items-center gap-1.5">
                            {change.current ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={productImageUrl(change.current, "thumb")} alt="" className="h-8 w-8 rounded object-fill" />
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                            →
                            {change.next && change.next !== "embedded" ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={productImageUrl(change.next, "thumb")} alt="" className="h-8 w-8 rounded object-fill" />
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </span>
                        ) : (
                          <span className="break-all">
                            <span className="text-zinc-500 line-through">{change.current || "—"}</span> →{" "}
                            <span className="font-semibold text-zinc-900 dark:text-zinc-50">{change.next || "—"}</span>
                          </span>
                        )}
                      </label>
                    ))}

                  {item.fileStock != null && (
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                      <span className="font-medium">{dict.importFieldStock}:</span>
                      <select
                        disabled={!choice.selected}
                        value={choice.stockMode}
                        onChange={(e) => update(item.code, (c) => ({ ...c, stockMode: e.target.value as StockMode }))}
                        className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <option value="replace">{dict.importMergeStockReplace}</option>
                        <option value="add">{dict.importMergeStockAdd}</option>
                        <option value="skip">{dict.importMergeStockSkip}</option>
                      </select>
                      <span className="tabular-nums text-zinc-500">
                        {choice.stockMode === "add"
                          ? `${item.currentStock} + ${item.fileStock} = ${Math.max(0, item.currentStock + item.fileStock)}`
                          : choice.stockMode === "replace"
                          ? `${item.currentStock} → ${item.fileStock}`
                          : `${item.currentStock}`}
                      </span>
                      {!stockChange && choice.stockMode === "replace" && (
                        <span className="text-zinc-400">({dict.importMergeStockSame})</span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-zinc-500">
            {dict.returnSelectedLabel} {selectedCount} / {pending.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
            >
              {dict.cancel}
            </button>
            <button
              type="button"
              disabled={working || selectedCount === 0}
              onClick={submit}
              className="rounded-full bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-60"
            >
              {working ? dict.importMergeWorking : `${dict.importMergeApply} (${selectedCount})`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
