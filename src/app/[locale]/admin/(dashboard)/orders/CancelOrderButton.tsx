"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/context/ConfirmContext";
import { cancelOrderByNumberAction } from "./actions";
import { RowActionButton, XCircleIcon } from "@/components/admin/RowActions";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

/** «Отменить весь заказ»: кнопкой в шапке заказа или иконкой в списке. */
export default function CancelOrderButton({
  locale,
  dict,
  orderNumber,
  variant = "button",
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  orderNumber: number;
  variant?: "button" | "icon";
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const ok = await confirm({
      title: dict.orderCancelAllTitle,
      message: `${dict.orderCancelAllConfirm} №${orderNumber}?`,
      details: dict.orderCancelAllShippedNote,
      confirmLabel: dict.orderCancelAll,
    });
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const result = await cancelOrderByNumberAction(locale, orderNumber);
      if (result.error) {
        setError(result.error === "already_shipped" ? dict.orderCancelShippedError : result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      {variant === "icon" ? (
        <RowActionButton label={dict.orderCancelAll} disabled={pending} danger onClick={handleClick}>
          <XCircleIcon />
        </RowActionButton>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={handleClick}
          className="rounded-full border border-red-300 px-5 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:hover:bg-red-950/40"
        >
          {pending ? dict.orderCancelAllWorking : dict.orderCancelAll}
        </button>
      )}
      {error && <span className="max-w-xs text-right text-xs text-red-600">{error}</span>}
    </span>
  );
}
