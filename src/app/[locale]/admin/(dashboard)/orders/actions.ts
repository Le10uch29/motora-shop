"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { logAction } from "@/lib/logs";
import { PROGRESSABLE_STATUSES } from "./statusStyles";
import type { Locale } from "@/i18n/locales";

function revalidateOrderPaths(locale: Locale, customerId: string, id: string) {
  revalidatePath(`/${locale}/admin/orders`);
  revalidatePath(`/${locale}/admin/orders/${customerId}`);
  revalidatePath(`/${locale}/admin/orders/${customerId}/${id}`);
}

/** Progresses an order through fulfillment (new/gathering/gathered/shipped/
 * delivered) — open to admin and seller. Cancelling is a separate action,
 * admin-only (see cancelOrderAction and the RLS policies backing both). */
export async function updateOrderStatusAction(
  locale: Locale,
  id: string,
  customerId: string,
  status: (typeof PROGRESSABLE_STATUSES)[number],
  label: string
): Promise<{ error: string | null }> {
  const actor = await requireStaff(locale);
  if (!PROGRESSABLE_STATUSES.includes(status)) {
    return { error: "invalid_status" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({
      status,
      // Stamps whichever seller/admin advanced the order with their own
      // warehouse — never chosen manually, and never cleared if the acting
      // staff member happens to have no warehouse assigned.
      ...(actor.warehouseId ? { warehouse_id: actor.warehouseId } : {}),
    })
    .eq("id", id)
    .neq("status", "cancelled");

  if (error) return { error: error.message };

  await logAction(actor, "update", "order", `${label} → ${status}`, { entityId: id });
  revalidateOrderPaths(locale, customerId, id);
  return { error: null };
}

/** Admin-only price override for one order line — flows into the orderer's
 * total and the invoice. Pass null to clear the override and fall back to
 * price_at_order. */
export async function updateOrderDiscountAction(
  locale: Locale,
  id: string,
  customerId: string,
  discountedPrice: number | null,
  label: string
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);

  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ discounted_price: discountedPrice })
    .eq("id", id);

  if (error) return { error: error.message };

  await logAction(actor, "update", "order", label, { entityId: id });
  revalidateOrderPaths(locale, customerId, id);
  return { error: null };
}

export async function cancelOrderAction(
  locale: Locale,
  id: string,
  customerId: string,
  label: string
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);

  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "cancelled");

  if (error) return { error: error.message };

  await logAction(actor, "delete", "order", label, { entityId: id });
  revalidateOrderPaths(locale, customerId, id);
  return { error: null };
}
