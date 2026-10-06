"use client";

import { useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { updateOrderQuantityAction } from "../actions";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

/** Количество в строке заказа, правится на месте — как и цена рядом.
 * Сделано одинаково с OrderDiscountInput: значение сохраняется по выходу из
 * поля или по Enter, чтобы не слать запрос на каждую набранную цифру. */
export default function OrderQuantityInput({
  locale,
  dict,
  orderId,
  orderNumber,
  label,
  quantity,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  orderId: string;
  orderNumber: number;
  label: string;
  quantity: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(quantity));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function commit() {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setError(dict.orderQuantityInvalid);
      setValue(String(quantity));
      return;
    }
    setError(null);
    if (parsed === quantity) return;

    startTransition(async () => {
      const result = await updateOrderQuantityAction(locale, orderId, orderNumber, parsed, label);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    }
  }

  return (
    <div className="flex flex-col gap-0.5">
      <input
        type="number"
        min={1}
        step={1}
        value={value}
        disabled={pending}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        aria-label={dict.orderColumnQuantity}
        className="w-20 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
