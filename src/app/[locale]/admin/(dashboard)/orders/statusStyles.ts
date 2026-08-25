import type { Dictionary } from "@/i18n/dictionary";
import type { OrderStatus } from "./data";

const GOLD_CLASS = "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200";
const RED_CLASS = "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-200";
const BLUE_CLASS = "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-200";
const GREEN_CLASS = "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200";
const NEUTRAL_CLASS = "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

export function orderStatusLabel(status: OrderStatus, dict: Dictionary["admin"]): string {
  switch (status) {
    case "new":
      return dict.orderStatusNew;
    case "gathering":
      return dict.orderStatusGathering;
    case "gathered":
      return dict.orderStatusGathered;
    case "shipped":
      return dict.orderStatusShipped;
    case "delivered":
      return dict.orderStatusDelivered;
    case "cancelled":
      return dict.orderStatusCancelled;
  }
}

export function orderStatusClass(status: OrderStatus): string {
  switch (status) {
    case "new":
      return GOLD_CLASS;
    case "gathering":
    case "gathered": // legacy value, no longer assignable from the UI — keep it visibly distinct rather than crashing
      return RED_CLASS;
    case "shipped":
      return BLUE_CLASS;
    case "delivered":
      return GREEN_CLASS;
    case "cancelled":
      return NEUTRAL_CLASS;
  }
}

// Statuses a seller/admin can move an order through via the UI — everything
// except "cancelled" (admin-only, separate action) and the retired "gathered"
// step (still a valid DB value, just never offered again).
export const PROGRESSABLE_STATUSES: OrderStatus[] = ["new", "gathering", "shipped", "delivered"];
