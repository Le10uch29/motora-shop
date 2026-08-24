"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cancelOrderAction } from "../actions";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

export default function OrdererOrderRowActions({
  locale,
  dict,
  customerId,
  orderId,
  label,
  isAdmin,
  isCancellable,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  customerId: string;
  orderId: string;
  label: string;
  isAdmin: boolean;
  isCancellable: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCancel() {
    if (!window.confirm(dict.confirmCancelOrder)) return;
    startTransition(async () => {
      const result = await cancelOrderAction(locale, orderId, customerId, label);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
        <Link
          href={`/${locale}/admin/orders/${customerId}/${orderId}`}
          className="rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
        >
          {dict.actionDetails}
        </Link>
        {isAdmin && isCancellable && (
          <button
            type="button"
            disabled={pending}
            onClick={handleCancel}
            className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:border-red-500 disabled:opacity-60 dark:border-red-900"
          >
            {dict.actionCancelOrder}
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
