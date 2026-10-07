"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatusByNumberAction } from "../actions";
import { orderStatusClass, orderStatusLabel, PROGRESSABLE_STATUSES } from "../statusStyles";
import type { OrderStatus } from "../data";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

/**
 * Статус всего заказа — один на все его позиции.
 *
 * Отдельного статуса у позиции больше нет: заказ собирают и отправляют
 * целиком, а когда у каждой строки был свой переключатель, статусы расходились
 * и заказ переставал читаться как одно целое. Отменить отдельную позицию
 * по-прежнему можно — для этого есть своя кнопка в строке.
 */
export default function OrderStatusControl({
  locale,
  dict,
  orderNumber,
  /** null, если строки заказа разошлись по статусам. */
  status,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  orderNumber: number;
  status: OrderStatus | null;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleChange(next: OrderStatus) {
    if (!PROGRESSABLE_STATUSES.includes(next)) return;
    startTransition(async () => {
      const result = await updateOrderStatusByNumberAction(locale, orderNumber, next);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  // Устаревшие статусы старых заказов («собран», «доставлен») в списке не
  // предлагаются, но текущий показать надо — иначе управление покажет не то,
  // что в заказе на самом деле.
  const options: OrderStatus[] =
    status && !PROGRESSABLE_STATUSES.includes(status)
      ? [...PROGRESSABLE_STATUSES, status]
      : PROGRESSABLE_STATUSES;

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-500">{dict.orderStatusSelectLabel}</span>
        <select
          aria-label={dict.orderStatusSelectLabel}
          value={status ?? ""}
          disabled={pending}
          onChange={(event) => handleChange(event.target.value as OrderStatus)}
          className={`rounded-full border-0 px-3 py-1.5 text-sm font-medium ${
            status ? orderStatusClass(status) : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          {status === null && (
            // Строки разошлись по статусам — показываем это вместо одного из них.
            <option value="" disabled className="bg-white text-zinc-900">
              {dict.orderMixedStatuses}
            </option>
          )}
          {options.map((option) => (
            <option
              key={option}
              value={option}
              disabled={!PROGRESSABLE_STATUSES.includes(option)}
              className="bg-white text-zinc-900"
            >
              {orderStatusLabel(option, dict)}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
