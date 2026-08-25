"use client";

import { useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { updateOrderDiscountAction } from "../actions";
import { formatGel } from "@/lib/currency";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

export default function OrderDiscountInput({
  locale,
  dict,
  orderId,
  customerId,
  label,
  originalPrice,
  discountedPrice,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  orderId: string;
  customerId: string;
  label: string;
  originalPrice: number;
  discountedPrice: number | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(String(discountedPrice ?? originalPrice));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function commit() {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError(dict.discountedPriceInvalid);
      return;
    }
    setError(null);
    // Typing the original price back is the same as clearing the override.
    const nextDiscounted = parsed === originalPrice ? null : parsed;
    if (nextDiscounted === discountedPrice) return;

    startTransition(async () => {
      const result = await updateOrderDiscountAction(locale, orderId, customerId, nextDiscounted, label);
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
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          step="0.01"
          value={value}
          disabled={pending}
          onChange={(event) => setValue(event.target.value)}
          onBlur={commit}
          onKeyDown={handleKeyDown}
          className="w-24 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        {discountedPrice != null && (
          <span className="text-xs text-zinc-400 line-through">{formatGel(originalPrice, locale)}</span>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
