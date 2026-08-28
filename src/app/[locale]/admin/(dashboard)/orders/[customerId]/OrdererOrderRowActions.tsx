"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelOrderAction, deleteOrderAction, updateOrderStatusAction } from "../actions";
import { orderStatusLabel, orderStatusClass, PROGRESSABLE_STATUSES } from "../statusStyles";
import type { OrderStatus } from "../data";
import { RowActionLink, RowActionButton, EyeIcon, XCircleIcon, TrashIcon } from "@/components/admin/RowActions";
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
  currentStatus,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  customerId: string;
  orderId: string;
  label: string;
  isAdmin: boolean;
  isCancellable: boolean;
  currentStatus: OrderStatus;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isDeletable = currentStatus === "cancelled" || currentStatus === "delivered";

  function handleCancel() {
    if (!window.confirm(dict.confirmCancelOrder)) return;
    startTransition(async () => {
      const result = await cancelOrderAction(locale, orderId, customerId, label);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleDelete() {
    if (!window.confirm(dict.confirmDeleteOrder)) return;
    startTransition(async () => {
      const result = await deleteOrderAction(locale, orderId, customerId, label);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleStatusChange(status: OrderStatus) {
    if (status === "cancelled" || !PROGRESSABLE_STATUSES.includes(status)) return;
    startTransition(async () => {
      const result = await updateOrderStatusAction(locale, orderId, customerId, status, label);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
        {currentStatus === "cancelled" ? (
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${orderStatusClass(currentStatus)}`}>
            {orderStatusLabel(currentStatus, dict)}
          </span>
        ) : (
          <select
            aria-label={dict.orderStatusSelectLabel}
            value={currentStatus}
            disabled={pending}
            onChange={(event) => handleStatusChange(event.target.value as OrderStatus)}
            className={`rounded-full border-0 px-2.5 py-1.5 text-xs font-medium ${orderStatusClass(currentStatus)}`}
          >
            {PROGRESSABLE_STATUSES.map((status) => (
              // The dropdown list itself ignores the <select>'s Tailwind
              // classes in most browsers, so each <option> needs its own
              // (plain, always-readable) colors — the colored pill look is
              // only for the closed control.
              <option key={status} value={status} className="bg-white text-zinc-900">
                {orderStatusLabel(status, dict)}
              </option>
            ))}
          </select>
        )}
        <RowActionLink href={`/${locale}/admin/orders/${customerId}/${orderId}`} label={dict.actionDetails}>
          <EyeIcon />
        </RowActionLink>
        {isAdmin && isCancellable && (
          <RowActionButton label={dict.actionCancelOrder} disabled={pending} danger onClick={handleCancel}>
            <XCircleIcon />
          </RowActionButton>
        )}
        {isAdmin && isDeletable && (
          <RowActionButton label={dict.actionDelete} disabled={pending} danger onClick={handleDelete}>
            <TrashIcon />
          </RowActionButton>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
