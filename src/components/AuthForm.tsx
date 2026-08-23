"use client";

import { useState, type FormEvent } from "react";

export default function AuthForm({
  title,
  emailLabel,
  passwordLabel,
  submitLabel,
  note,
}: {
  title: string;
  emailLabel: string;
  passwordLabel: string;
  submitLabel: string;
  note: string;
}) {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="auth-email" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {emailLabel}
          </label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="auth-password"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            {passwordLabel}
          </label>
          <input
            id="auth-password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
        >
          {submitLabel}
        </button>
      </form>
      {submitted && <p className="text-sm text-zinc-500">{note}</p>}
    </main>
  );
}
