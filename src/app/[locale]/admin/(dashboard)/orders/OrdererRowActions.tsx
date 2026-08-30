"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkUpdateOrdererStatusAction, bulkDeleteOrdererOrdersAction } from "./actions";
import { orderStatusLabel, PROGRESSABLE_STATUSES } from "./statusStyles";
import type { OrderStatus } from "./data";
import { RowActionLink, RowActionButton, EyeIcon, TrashIcon } from "@/components/admin/RowActions";
import type { Dictionary } from "@/i18n/dictionary";
import type { Locale } from "@/i18n/locales";

export default function OrdererRowActions({
  locale,
  dict,
  customerId,
  label,
  isAdmin,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  customerId: string;
  label: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleBulkStatusChange(status: OrderStatus) {
    if (!PROGRESSABLE_STATUSES.includes(status)) return;
    if (!window.confirm(`${dict.confirmBulkStatusChange} ${label}?`)) return;
    startTransition(async () => {
      const result = await bulkUpdateOrdererStatusAction(locale, customerId, status);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  function handleBulkDelete() {
    if (!window.confirm(`${dict.confirmBulkDeleteOrders} ${label}?`)) return;
    startTransition(async () => {
      const result = await bulkDeleteOrdererOrdersAction(locale, customerId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2 whitespace-nowrap">
        <select
          aria-label={dict.bulkStatusChangeLabel}
          value=""
          disabled={pending}
          onChange={(event) => {
            const status = event.target.value as OrderStatus;
            if (status) handleBulkStatusChange(status);
          }}
          className="rounded-full border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          <option value="" className="bg-white text-zinc-900">
            {dict.bulkStatusChangeLabel}
          </option>
          {PROGRESSABLE_STATUSES.map((status) => (
            <option key={status} value={status} className="bg-white text-zinc-900">
              {orderStatusLabel(status, dict)}
            </option>
          ))}
        </select>
        <RowActionLink href={`/${locale}/admin/orders/${customerId}`} label={dict.actionDetails}>
          <EyeIcon />
        </RowActionLink>
        {isAdmin && (
          <RowActionButton label={dict.actionDelete} disabled={pending} danger onClick={handleBulkDelete}>
            <TrashIcon />
          </RowActionButton>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
