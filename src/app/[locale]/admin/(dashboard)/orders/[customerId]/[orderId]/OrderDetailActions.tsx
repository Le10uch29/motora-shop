"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelOrderAction } from "../../actions";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

export default function OrderDetailActions({
  locale,
  dict,
  id,
  customerId,
  label,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  id: string;
  customerId: string;
  label: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCancel() {
    if (!window.confirm(dict.confirmCancelOrder)) return;
    startTransition(async () => {
      const result = await cancelOrderAction(locale, id, customerId, label);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleCancel}
        className="w-fit rounded-full border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:border-red-500 disabled:opacity-60 dark:border-red-900"
      >
        {dict.actionCancelOrder}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
