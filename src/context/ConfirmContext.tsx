"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { Dictionary } from "@/i18n/dictionary";

export type ConfirmOptions = {
  /** Что именно произойдёт — главный текст окна. */
  message: string;
  /** Необязательная строка под ним: что удаляется, сколько штук и т. п. */
  details?: string;
  title?: string;
  confirmLabel?: string;
  /** "danger" — удаление: красная кнопка и предупреждение о необратимости. */
  tone?: "danger" | "default";
  /** false — не писать «нельзя отменить» (убрать из категории, из корзины). */
  irreversible?: boolean;
};

type Confirm = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/**
 * Окно подтверждения вместо системного window.confirm.
 *
 * Системное окно выглядит по-разному в каждом браузере, его легко «прокликать»
 * не читая, а на телефоне оно и вовсе теряется. Здесь одно окно на весь сайт:
 * `await confirm(...)` возвращает true, только если человек нажал кнопку
 * подтверждения; Escape, клик мимо окна и «Отмена» — это false.
 */
export function ConfirmProvider({
  dict,
  children,
}: {
  dict: Dictionary["confirmDialog"];
  children: ReactNode;
}) {
  const [request, setRequest] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((options) => {
    // Предыдущий незакрытый запрос считается отменённым.
    resolveRef.current?.(false);
    setRequest(
      typeof options === "string"
        ? { message: options, tone: "danger" }
        : options,
    );
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolveRef.current?.(result);
    resolveRef.current = null;
    setRequest(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <ConfirmDialog dict={dict} request={request} onClose={close} />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm)
    throw new Error("useConfirm must be used inside ConfirmProvider");
  return confirm;
}

function ConfirmDialog({
  dict,
  request,
  onClose,
}: {
  dict: Dictionary["confirmDialog"];
  request: ConfirmOptions;
  onClose: (result: boolean) => void;
}) {
  const danger = (request.tone ?? "danger") === "danger";
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Фокус на «Отмена»: случайный Enter не должен ничего удалить.
    cancelRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-16">
      <div
        className="absolute inset-0"
        onClick={() => onClose(false)}
        aria-hidden="true"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="relative flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              danger
                ? "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-500"
                : "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-500"
            }`}
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </svg>
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h2
              id="confirm-dialog-title"
              className="text-lg font-bold text-zinc-900 dark:text-zinc-50"
            >
              {request.title ?? (danger ? dict.deleteTitle : dict.title)}
            </h2>
            <p
              id="confirm-dialog-message"
              className="whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300"
            >
              {request.message}
            </p>
            {request.details && (
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {request.details}
              </p>
            )}
            {danger && request.irreversible !== false && (
              <p className="text-xs text-red-600 dark:text-red-500">
                {dict.irreversible}
              </p>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-center gap-3">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onClose(false)}
            className="flex-1 rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
          >
            {dict.cancel}
          </button>
          <button
            type="button"
            onClick={() => onClose(true)}
            className={`flex-1 rounded-full px-4 py-2.5 text-sm font-semibold text-white transition-colors ${
              danger
                ? "bg-red-600 hover:bg-red-500"
                : "bg-orange-600 hover:bg-orange-500"
            }`}
          >
            {request.confirmLabel ?? (danger ? dict.delete : dict.confirm)}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
