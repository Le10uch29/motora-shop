"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelOrderAction, deleteOrderAction } from "../actions";
import { orderStatusLabel, orderStatusClass } from "../statusStyles";
import type { OrderStatus } from "../data";
import { RowActionLink, RowActionButton, EyeIcon, XCircleIcon, TrashIcon } from "@/components/admin/RowActions";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

export default function OrderLineRowActions({
  locale,
  dict,
  orderNumber,
  orderId,
  label,
  isAdmin,
  isCancellable,
  currentStatus,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  orderNumber: number;
  orderId: string;
  label: string;
  isAdmin: boolean;
  isCancellable: boolean;
  currentStatus: OrderStatus;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleCancel() {
    if (!window.confirm(dict.confirmCancelOrder)) return;
    startTransition(async () => {
      const result = await cancelOrderAction(locale, orderId, orderNumber, label);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleDelete() {
    if (!window.confirm(dict.confirmDeleteOrder)) return;
    startTransition(async () => {
      const result = await deleteOrderAction(locale, orderId, orderNumber, label);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
        {/* Статуса у отдельной позиции здесь больше нет: заказ двигают
            целиком, переключатель один на весь заказ в его шапке. Отменённую
            строку всё же помечаем — она выпадает из общего статуса заказа, и
            об этом надо знать. */}
        {currentStatus === "cancelled" && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusClass(currentStatus)}`}>
            {orderStatusLabel(currentStatus, dict)}
          </span>
        )}
        <RowActionLink href={`/${locale}/admin/orders/${orderNumber}/${orderId}`} label={dict.actionDetails}>
          <EyeIcon />
        </RowActionLink>
        {isAdmin && isCancellable && (
          <RowActionButton label={dict.actionCancelOrder} disabled={pending} danger onClick={handleCancel}>
            <XCircleIcon />
          </RowActionButton>
        )}
        {isAdmin && (
          <RowActionButton label={dict.actionDelete} disabled={pending} danger onClick={handleDelete}>
            <TrashIcon />
          </RowActionButton>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
