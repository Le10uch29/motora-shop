"use client";

import { useActionState, useState } from "react";
import { signInAction, type SignInState } from "./actions";

const initialState: SignInState = { error: null };

export default function AdminLoginForm({
  locale,
  title,
  identifierLabel,
  passwordLabel,
  submitLabel,
  submittingLabel,
  invalidCredentialsMessage,
}: {
  locale: string;
  title: string;
  identifierLabel: string;
  passwordLabel: string;
  submitLabel: string;
  submittingLabel: string;
  invalidCredentialsMessage: string;
}) {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  const [identifier, setIdentifier] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Форма остаётся «занятой», пока браузер не ушёл на новую страницу: `pending`
  // гаснет раньше перехода, и ожившая кнопка с пустыми полями читалась как
  // «вход не сработал». Та же причина, что и в форме входа на витрине.
  const busy = pending || (submitted && !state.error);
  if (state.error && submitted) setSubmitted(false);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-2 py-16">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
      <form
        action={formAction}
        onSubmit={() => setSubmitted(true)}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="invalidCredentialsMessage" value={invalidCredentialsMessage} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="admin-identifier" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {identifierLabel}
          </label>
          <input
            id="admin-identifier"
            name="identifier"
            required
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="admin-password"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {passwordLabel}
          </label>
          <input
            id="admin-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-60"
        >
          {busy ? submittingLabel : submitLabel}
        </button>
      </form>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </main>
  );
}
