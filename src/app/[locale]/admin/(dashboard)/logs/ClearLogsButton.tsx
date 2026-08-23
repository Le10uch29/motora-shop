"use client";

import { useState, useTransition } from "react";
import { clearLogsAction } from "./actions";
import type { Locale } from "@/i18n/locales";

export default function ClearLogsButton({
  locale,
  label,
  confirmMessage,
}: {
  locale: Locale;
  label: string;
  confirmMessage: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(confirmMessage)) return;
    startTransition(async () => {
      const result = await clearLogsAction(locale);
      setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className="rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:border-red-500 disabled:opacity-60 dark:border-red-900"
      >
        {label}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
