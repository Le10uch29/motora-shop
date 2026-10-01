"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import {
  deleteOrdersAction,
  setStatsSinceAction,
  type ResetState,
} from "@/app/[locale]/admin/(dashboard)/resetActions";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

type Dash = Dictionary["dashboard"];

/** Коды, которые возвращает действие, — в человеческий текст. Всё остальное
 * показываем как есть: это сообщение от базы, и его полезно видеть. */
function errorText(code: string, d: Dash): string {
  if (code === "settings_table_missing") return d.resetSettingsMissing;
  if (code === "confirmation_mismatch") return d.resetConfirmMismatch;
  return code;
}

/**
 * Обнуление цифр дашборда на время тестов.
 *
 * Два разных действия, и разница между ними важна:
 *
 * - «обнулить статистику» ставит дату отсечки. Заказы остаются в разделе
 *   «Заказы», их можно дообработать, но выручка и продажи считаются с нуля.
 *   Это отменяется одной кнопкой;
 * - «удалить заказы» убирает их из базы. Необратимо, поэтому требует набрать
 *   слово подтверждения: кнопку можно нажать мимо, слово — нет.
 */
export default function DataResetCard({
  locale,
  d,
  state,
  cancelLabel,
}: {
  locale: Locale;
  d: Dash;
  state: ResetState;
  /** Из словаря админки — «Отмена» там уже переведена. */
  cancelLabel: string;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEscapeKey(() => setConfirmOpen(false), confirmOpen);

  function runStatsSince(mode: "now" | "clear") {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await setStatsSinceAction(locale, mode);
      if (result.error) setError(errorText(result.error, d));
      else setMessage(mode === "now" ? d.resetStatsDone : d.resetStatsCleared);
    });
  }

  function deleteOrders() {
    setError(null);
    startTransition(async () => {
      const result = await deleteOrdersAction(locale, confirmation, d.resetConfirmWord);
      if (result.error) {
        setError(errorText(result.error, d));
        return;
      }
      setMessage(`${d.resetOrdersDone} ${result.deleted ?? 0}`);
      setConfirmation("");
      setConfirmOpen(false);
    });
  }

  const sinceLabel = state.statsSince
    ? new Date(state.statsSince).toLocaleString("ru-RU", { timeZone: "Asia/Tbilisi" })
    : null;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-amber-300 bg-white p-4 shadow-sm shadow-black/5 sm:p-5 dark:border-amber-900/60 dark:bg-zinc-900">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-500">
          {d.resetTitle}
        </h2>
        <p className="text-sm text-zinc-500">{d.resetHint}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div className="flex flex-col rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-950/40">
          <dt className="text-xs uppercase tracking-wide text-zinc-500">{d.resetOrdersTotal}</dt>
          <dd className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {state.ordersTotal}
          </dd>
        </div>
        <div className="flex flex-col rounded-xl bg-zinc-50 px-3 py-2 dark:bg-zinc-950/40">
          <dt className="text-xs uppercase tracking-wide text-zinc-500">{d.resetOrdersCounted}</dt>
          <dd className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
            {state.ordersCounted}
          </dd>
        </div>
        <div className="col-span-2 flex flex-col rounded-xl bg-zinc-50 px-3 py-2 sm:col-span-1 dark:bg-zinc-950/40">
          <dt className="text-xs uppercase tracking-wide text-zinc-500">{d.resetStatsSince}</dt>
          <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            {sinceLabel ?? d.resetStatsSinceNever}
          </dd>
        </div>
      </dl>

      {message && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-500">
          {message}
        </p>
      )}
      {error && !confirmOpen && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => runStatsSince("now")}
          className="rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-500 disabled:opacity-60"
        >
          {d.resetStatsButton}
        </button>

        {state.statsSince && (
          <button
            type="button"
            disabled={pending}
            onClick={() => runStatsSince("clear")}
            className="rounded-full border border-zinc-200 px-5 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
          >
            {d.resetStatsClearButton}
          </button>
        )}

        <button
          type="button"
          disabled={pending || state.ordersTotal === 0}
          onClick={() => {
            setError(null);
            setMessage(null);
            setConfirmOpen(true);
          }}
          className="rounded-full border border-red-300 px-5 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:hover:bg-red-950/40"
        >
          {d.resetOrdersButton} ({state.ordersTotal})
        </button>
      </div>

      <p className="text-xs text-zinc-400">{d.resetKeepsEverythingElse}</p>

      {confirmOpen &&
        createPortal(
          <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-3 py-6 sm:px-4 sm:py-16">
            <div
              className="absolute inset-0"
              onClick={() => setConfirmOpen(false)}
              aria-hidden="true"
            />
            <div className="relative flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                {d.resetOrdersModalTitle}
              </h3>
              <p className="text-sm font-medium text-red-600 dark:text-red-500">
                {d.resetOrdersWarning.replace("{count}", String(state.ordersTotal))}
              </p>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">
                  {d.resetConfirmLabel} <strong className="font-mono">{d.resetConfirmWord}</strong>
                </span>
                <input
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                  className="rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmOpen(false)}
                  className="flex-1 rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  disabled={pending || confirmation.trim() === ""}
                  onClick={deleteOrders}
                  className="flex-1 rounded-full bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
                >
                  {d.resetOrdersButton}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
