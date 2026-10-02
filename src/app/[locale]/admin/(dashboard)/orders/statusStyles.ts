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
      return GREEN_CLASS;
    case "delivered": // legacy value, same reason as "gathered"
      return BLUE_CLASS;
    case "cancelled":
      return NEUTRAL_CLASS;
  }
}

// Statuses a seller/admin can move an order through via the UI — everything
// except "cancelled" (admin-only, separate action) and the retired "gathered"
// and "delivered" steps (still valid DB values on older orders, just never
// offered again). "shipped" is the final step: once the goods have left the
// warehouse the shop's part is done, and nobody was confirming delivery.
export const PROGRESSABLE_STATUSES: OrderStatus[] = ["new", "gathering", "shipped"];

// Fulfillment order, including the two retired steps so old orders still
// compare correctly. "cancelled" is deliberately absent: it's a side exit
// from the flow, not a point along it.
const FULFILLMENT_ORDER: OrderStatus[] = ["new", "gathering", "gathered", "shipped", "delivered"];

/** The step at which the goods physically leave the warehouse, so stock is
 * written off. Anything at or past it counts as shipped out. */
export const STOCK_DEDUCTION_STATUS: OrderStatus = "shipped";

/** True when `status` is at or past `milestone` in the fulfillment flow.
 * Used so a jump straight from "new" to a later status still triggers
 * everything the skipped steps would have: before this, choosing the last
 * status in one go silently lost the stock write-off. */
export function isStatusAtOrPast(status: OrderStatus, milestone: OrderStatus): boolean {
  const index = FULFILLMENT_ORDER.indexOf(status);
  return index >= 0 && index >= FULFILLMENT_ORDER.indexOf(milestone);
}

/** An order may be deleted only once it's out of the flow: cancelled, or
 * already shipped out (which includes the legacy "delivered"). */
export function isOrderDeletable(status: OrderStatus): boolean {
  return status === "cancelled" || isStatusAtOrPast(status, STOCK_DEDUCTION_STATUS);
}
