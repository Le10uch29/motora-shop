"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/context/ConfirmContext";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { changeImportBrandAction, rollbackImportAction } from "../importRunActions";
import type { ImportRunActionResult, ImportRunRow } from "../productTypes";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

type Outcome = { runId: string; kind: "rollback" | "move"; result: ImportRunActionResult };

/** Таблица запусков импорта с откатом, переносом на бренд и ссылкой на товары. */
export default function ImportRunsClient({
  locale,
  dict,
  runs,
  brands,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  runs: ImportRunRow[];
  brands: { id: string; name: string }[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [busyRun, setBusyRun] = useState<string | null>(null);
  const [moveFor, setMoveFor] = useState<ImportRunRow | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  function errorText(code: string): string {
    if (code === "already_rolled_back") return dict.importErrorAlreadyRolledBack;
    return code;
  }

  async function handleRollback(run: ImportRunRow) {
    const ok = await confirm({
      message: dict.importRollbackConfirm,
      details: [run.brandName, run.fileName, new Date(run.createdAt).toLocaleString(locale)]
        .filter(Boolean)
        .join(" · "),
      confirmLabel: dict.importActionRollback,
    });
    if (!ok) return;
    setBusyRun(run.id);
    startTransition(async () => {
      const result = await rollbackImportAction(locale, run.id);
      setOutcome({ runId: run.id, kind: "rollback", result });
      setBusyRun(null);
      router.refresh();
    });
  }

  function handleMove(run: ImportRunRow, brandId: string) {
    setMoveFor(null);
    setBusyRun(run.id);
    startTransition(async () => {
      const result = await changeImportBrandAction(locale, run.id, brandId);
      setOutcome({ runId: run.id, kind: "move", result });
      setBusyRun(null);
      router.refresh();
    });
  }

  if (runs.length === 0) {
    return <p className="py-16 text-center text-zinc-500">{dict.importHistoryEmpty}</p>;
  }

  const skipReason = (reason: ImportRunActionResult["skipped"][number]["reason"]) =>
    ({
      edited: dict.importSkipEdited,
      in_orders: dict.importSkipInOrders,
      deleted: dict.importSkipDeleted,
      duplicate: dict.importSkipDuplicate,
    })[reason];

  return (
    <div className="flex flex-col gap-4">
      {outcome && (
        <div
          className={`flex flex-col gap-2 rounded-xl border p-4 text-sm ${
            outcome.result.error
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}
        >
          {outcome.result.error ? (
            <p>{errorText(outcome.result.error)}</p>
          ) : outcome.kind === "rollback" ? (
            <p>
              {dict.importResultDeleted}: <strong>{outcome.result.done}</strong> · {dict.importResultRestored}:{" "}
              <strong>{outcome.result.restored}</strong> · {dict.importResultStock}:{" "}
              <strong>{outcome.result.stockRestored}</strong>
            </p>
          ) : (
            <p>
              {dict.importResultMoved}: <strong>{outcome.result.done}</strong>
              {outcome.result.leftUpdated ? (
                <>
                  {" "}
                  · {dict.importResultLeftUpdated}: <strong>{outcome.result.leftUpdated}</strong>
                </>
              ) : null}
            </p>
          )}
          {outcome.result.skipped.length > 0 && (
            <details>
              <summary className="cursor-pointer">
                {dict.importResultSkippedTitle}: {outcome.result.skipped.length}
              </summary>
              <ul className="mt-2 max-h-48 overflow-y-auto font-mono text-xs">
                {outcome.result.skipped.map((item, index) => (
                  <li key={`${item.code}-${index}`}>
                    {item.code} — {skipReason(item.reason)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 font-medium">{dict.importColDate}</th>
              <th className="px-4 py-3 font-medium">{dict.importColStaff}</th>
              <th className="px-4 py-3 font-medium">{dict.importColFile}</th>
              <th className="px-4 py-3 font-medium">{dict.importColBrand}</th>
              <th className="px-4 py-3 font-medium">{dict.importColResult}</th>
              <th className="px-4 py-3 font-medium">{dict.importColStatus}</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {runs.map((run) => {
              const rolledBack = run.status === "rolled_back";
              const busy = pending && busyRun === run.id;
              return (
                <tr key={run.id} className={rolledBack ? "opacity-60" : undefined}>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {new Date(run.createdAt).toLocaleString(locale)}
                  </td>
                  <td className="px-4 py-3 text-zinc-900 dark:text-zinc-50">{run.staffName}</td>
                  <td className="max-w-[14rem] truncate px-4 py-3 text-zinc-600 dark:text-zinc-400" title={run.fileName ?? undefined}>
                    {run.fileName || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">{run.brandName}</span>
                    {run.movedToBrandName && (
                      <span className="block text-xs text-orange-600">
                        {dict.importMovedToLabel} {run.movedToBrandName}
                      </span>
                    )}
                    {run.warehouseName && <span className="block text-xs text-zinc-400">{run.warehouseName}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                    <span className="block">
                      <strong className="text-zinc-900 dark:text-zinc-50">{run.created}</strong> {dict.importCreatedLabel} ·{" "}
                      <strong className="text-zinc-900 dark:text-zinc-50">{run.updated}</strong> {dict.importUpdatedLabel}
                    </span>
                    <span className="block">
                      {run.unchanged} {dict.importUnchangedLabel} · {run.skipped} {dict.importSkippedLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {rolledBack ? (
                      <span className="text-zinc-500">
                        {dict.importStatusRolledBack}
                        {run.rolledBackAt && <span className="block">{new Date(run.rolledBackAt).toLocaleString(locale)}</span>}
                        {run.rolledBackBy && <span className="block">{run.rolledBackBy}</span>}
                      </span>
                    ) : (
                      <span className="text-emerald-600">{dict.importStatusDone}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                      <Link
                        href={`/${locale}/admin/products?import=${run.id}`}
                        className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        {dict.importActionProducts}
                      </Link>
                      {!rolledBack && (
                        <>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setMoveFor(run)}
                            className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
                          >
                            {dict.importActionChangeBrand}
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => handleRollback(run)}
                            className="rounded-full border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:hover:bg-red-950/40"
                          >
                            {busy ? "…" : dict.importActionRollback}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {moveFor && (
        <ChangeBrandModal
          dict={dict}
          run={moveFor}
          brands={brands}
          onClose={() => setMoveFor(null)}
          onSubmit={(brandId) => handleMove(moveFor, brandId)}
        />
      )}
    </div>
  );
}

function ChangeBrandModal({
  dict,
  run,
  brands,
  onClose,
  onSubmit,
}: {
  dict: Dictionary["admin"];
  run: ImportRunRow;
  brands: { id: string; name: string }[];
  onClose: () => void;
  onSubmit: (brandId: string) => void;
}) {
  // Текущий бренд импорта в списке не предлагаем — переносить на него незачем.
  const options = brands.filter((brand) => brand.name !== (run.movedToBrandName ?? run.brandName));
  const [brandId, setBrandId] = useState(options[0]?.id ?? "");
  useEscapeKey(onClose);

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-16">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{dict.importChangeBrandTitle}</h2>
          <p className="text-sm text-zinc-500">{dict.importChangeBrandHint}</p>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {run.movedToBrandName ?? run.brandName} → …
          </p>
        </div>
        <select
          value={brandId}
          onChange={(event) => setBrandId(event.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          {options.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            {dict.cancel}
          </button>
          <button
            type="button"
            disabled={!brandId}
            onClick={() => onSubmit(brandId)}
            className="flex-1 rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
          >
            {dict.importChangeBrandSubmit}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
