"use client";

import { useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { changeCustomerPasswordAction } from "./actions";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

/** Новый пароль покупателю: свой или сгенерированный. После смены пароль
 * показывается, чтобы его можно было передать покупателю. */
export default function CustomerPasswordModal({
  locale,
  dict,
  customer,
  onClose,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  customer: { id: string; name: string };
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  useEscapeKey(onClose);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await changeCustomerPasswordAction(locale, customer.id, password);
      if (res.error) {
        setError(res.error === "password_too_short" ? dict.passwordTooShort : res.error);
        return;
      }
      setResult(res.password);
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-16">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            {result ? dict.passwordChangedTitle : dict.customerPasswordTitle}
          </h2>
          <span className="text-sm text-zinc-500">{customer.name}</span>
        </div>

        {result ? (
          <>
            <p className="text-sm text-zinc-500">{dict.tempPasswordHint}</p>
            <span className="select-all rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-lg font-semibold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50">
              {result}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
            >
              {dict.close}
            </button>
          </>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="customer-new-password" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {dict.newPasswordLabel}
              </label>
              <input
                id="customer-new-password"
                type="text"
                autoComplete="new-password"
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 font-mono text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <span className="text-xs text-zinc-500">{dict.newPasswordHint}</span>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex items-center gap-3">
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
                {dict.changePasswordSubmit}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}
