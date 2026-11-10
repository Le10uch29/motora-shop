"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useConfirm } from "@/context/ConfirmContext";
import { returnOrderLinesAction } from "../actions";
import { productImageUrl } from "@/lib/productImageUrl";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

export type ReturnableLine = {
  id: string;
  productName: string;
  productCode: string | null;
  productImage: string | null;
  /** Сколько можно вернуть: отправлено минус уже возвращённое. */
  remaining: number;
};

/** Кнопка «Возврат» и окно выбора: какие позиции и сколько штук вернуть. */
export default function ReturnOrderButton({
  locale,
  dict,
  orderNumber,
  lines,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  orderNumber: number;
  lines: ReturnableLine[];
}) {
  const [open, setOpen] = useState(false);
  if (lines.length === 0) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-sky-600 px-5 py-2 text-sm font-semibold text-sky-700 transition-colors hover:bg-sky-50 dark:text-sky-400 dark:hover:bg-sky-950/40"
      >
        {dict.returnButton}
      </button>
      {open && (
        <ReturnModal
          locale={locale}
          dict={dict}
          orderNumber={orderNumber}
          lines={lines}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ReturnModal({
  locale,
  dict,
  orderNumber,
  lines,
  onClose,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  orderNumber: number;
  lines: ReturnableLine[];
  onClose: () => void;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [search, setSearch] = useState("");
  // Сколько вернуть по каждой строке; нет записи — не возвращать.
  const [amounts, setAmounts] = useState<Map<string, number>>(new Map());
  useEscapeKey(onClose);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return lines;
    return lines.filter((line) =>
      `${line.productCode ?? ""} ${line.productName}`.toLowerCase().includes(needle)
    );
  }, [lines, search]);

  const selectedCount = amounts.size;
  const selectedUnits = [...amounts.values()].reduce((sum, value) => sum + value, 0);
  const allSelected = lines.every((line) => amounts.get(line.id) === line.remaining);

  function setAmount(line: ReturnableLine, value: number) {
    setAmounts((prev) => {
      const next = new Map(prev);
      const clamped = Math.max(0, Math.min(line.remaining, Math.floor(value) || 0));
      if (clamped > 0) next.set(line.id, clamped);
      else next.delete(line.id);
      return next;
    });
  }

  function toggleAll() {
    setAmounts(allSelected ? new Map() : new Map(lines.map((line) => [line.id, line.remaining])));
  }

  const errorText = (code: string): string => {
    switch (code) {
      case "not_shipped":
        return dict.returnErrorNotShipped;
      case "return_exceeds":
        return dict.returnErrorExceeds;
      case "returns_not_installed":
        return dict.returnErrorNotInstalled;
      case "nothing_selected":
        return dict.returnErrorNothingSelected;
      default:
        return code;
    }
  };

  async function submit() {
    if (selectedUnits === 0) {
      setError(dict.returnErrorNothingSelected);
      return;
    }
    const ok = await confirm({
      title: dict.returnConfirmTitle,
      message: dict.returnConfirmMessage,
      details: `${dict.returnSelectedLabel} ${selectedCount} · ${dict.returnUnitsLabel} ${selectedUnits}`,
      confirmLabel: dict.returnSubmit,
      tone: "default",
      irreversible: true,
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await returnOrderLinesAction(
        locale,
        orderNumber,
        [...amounts].map(([orderId, quantity]) => ({ orderId, quantity })),
        reason
      );
      if (result.error) {
        setError(errorText(result.error));
        return;
      }
      onClose();
      router.refresh();
    });
  }

  const inputClass =
    "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-16">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="return-title"
        className="relative flex w-full max-w-2xl flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between">
          <h2 id="return-title" className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {dict.returnTitle} · №{orderNumber}
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

        <p className="text-sm text-zinc-500">{dict.returnHint}</p>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={dict.orderLinesSearchPlaceholder}
            className={`${inputClass} min-w-0 flex-1`}
          />
          <button
            type="button"
            onClick={toggleAll}
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            {allSelected ? dict.returnClearAll : dict.returnSelectAll}
          </button>
        </div>

        <ul className="flex max-h-[50vh] flex-col divide-y divide-zinc-200 overflow-y-auto rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {visible.map((line) => {
            const amount = amounts.get(line.id) ?? 0;
            return (
              <li key={line.id} className="flex items-center gap-3 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={amount > 0}
                  onChange={(e) => setAmount(line, e.target.checked ? line.remaining : 0)}
                  aria-label={line.productName}
                  className="h-4 w-4 shrink-0 rounded border-zinc-300"
                />
                {line.productImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={productImageUrl(line.productImage, "thumb")}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-lg object-fill"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {line.productName}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {line.productCode || "—"} · {dict.returnCanReturn} {line.remaining}
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  max={line.remaining}
                  value={amount}
                  onChange={(e) => setAmount(line, Number(e.target.value))}
                  aria-label={dict.returnQuantityLabel}
                  className={`${inputClass} w-20 text-right tabular-nums`}
                />
              </li>
            );
          })}
        </ul>

        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {dict.returnReasonLabel}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={dict.returnReasonPlaceholder}
            className={inputClass}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-zinc-500">
            {dict.returnSelectedLabel} {selectedCount} · {dict.returnUnitsLabel} {selectedUnits}
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
              disabled={pending || selectedUnits === 0}
              onClick={submit}
              className="rounded-full bg-sky-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-500 disabled:opacity-60"
            >
              {pending ? dict.returnWorking : dict.returnSubmit}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
