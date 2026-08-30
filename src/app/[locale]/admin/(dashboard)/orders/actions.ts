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
 * admin-only (see cancelOrderAction and the RLS policies backing both).
 *
 * The first time an order reaches "shipped", its quantity is deducted both
 * from the product's overall stock and from the specific warehouse fulfilling
 * it (whichever warehouse this update — or an earlier one — attached to the
 * order). `stock_deducted_at` guards this so re-selecting "shipped" (or any
 * back-and-forth through the status dropdown) never double-deducts. */
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

  const { data: order } = await admin
    .from("orders")
    .select("quantity, product_id, warehouse_id, stock_deducted_at")
    .eq("id", id)
    .single();
  if (!order) return { error: "not_found" };

  // Stamps whichever seller/admin advanced the order with their own
  // warehouse — never chosen manually, and never cleared if the acting
  // staff member happens to have no warehouse assigned.
  const nextWarehouseId = actor.warehouseId ?? order.warehouse_id;
  const shouldDeductStock = status === "shipped" && !order.stock_deducted_at && order.product_id;

  const { error } = await admin
    .from("orders")
    .update({
      status,
      ...(nextWarehouseId ? { warehouse_id: nextWarehouseId } : {}),
      ...(shouldDeductStock ? { stock_deducted_at: new Date().toISOString() } : {}),
    })
    .eq("id", id)
    .neq("status", "cancelled");

  if (error) return { error: error.message };

  if (shouldDeductStock) {
    const { data: productRow } = await admin
      .from("products")
      .select("stock")
      .eq("id", order.product_id)
      .maybeSingle();
    if (productRow) {
      await admin
        .from("products")
        .update({ stock: Math.max(0, productRow.stock - order.quantity) })
        .eq("id", order.product_id);
    }

    if (nextWarehouseId) {
      const { data: stockRow } = await admin
        .from("warehouse_stock")
        .select("id, quantity")
        .eq("warehouse_id", nextWarehouseId)
        .eq("product_id", order.product_id)
        .maybeSingle();
      if (stockRow) {
        await admin
          .from("warehouse_stock")
          .update({ quantity: Math.max(0, stockRow.quantity - order.quantity) })
          .eq("id", stockRow.id);
      }
    }

    revalidatePath(`/${locale}/admin/products`);
    revalidatePath(`/${locale}/admin/warehouses`);
    if (nextWarehouseId) revalidatePath(`/${locale}/admin/warehouses/${nextWarehouseId}`);
  }

  await logAction(actor, "update", "order", `${label} → ${status}`, { entityId: id });
  revalidateOrderPaths(locale, customerId, id);
  return { error: null };
}

/** Moves every one of an orderer's active (non-cancelled) order lines to the
 * same next status at once — the top-level orders list shows one row per
 * customer/orderer, and a customer who ordered several different products
 * would otherwise need each line changed individually from their detail
 * page. Reuses updateOrderStatusAction per line so the stock-deduction
 * safety on "shipped" (and every other rule) stays in exactly one place. */
export async function bulkUpdateOrdererStatusAction(
  locale: Locale,
  customerId: string,
  status: (typeof PROGRESSABLE_STATUSES)[number]
): Promise<{ error: string | null }> {
  await requireStaff(locale);
  const admin = createAdminClient();

  const { data: activeOrders } = await admin
    .from("orders")
    .select("id, product_name")
    .eq("customer_id", customerId)
    .neq("status", "cancelled");

  const errors: string[] = [];
  for (const order of activeOrders ?? []) {
    const label = order.product_name?.[locale] ?? order.product_name?.ru ?? "";
    const result = await updateOrderStatusAction(locale, order.id, customerId, status, label);
    if (result.error) errors.push(result.error);
  }

  return { error: errors.length > 0 ? errors.join("; ") : null };
}

/** Deletes every one of an orderer's orders that's currently deletable
 * (cancelled or delivered — same rule as the single-order delete) — orders
 * still in progress are left untouched. Reuses deleteOrderAction per line. */
export async function bulkDeleteOrdererOrdersAction(
  locale: Locale,
  customerId: string
): Promise<{ error: string | null; deleted: number }> {
  await requireAdmin(locale);
  const admin = createAdminClient();

  const { data: deletableOrders } = await admin
    .from("orders")
    .select("id, product_name")
    .eq("customer_id", customerId)
    .in("status", ["cancelled", "delivered"]);

  let deleted = 0;
  const errors: string[] = [];
  for (const order of deletableOrders ?? []) {
    const label = order.product_name?.[locale] ?? order.product_name?.ru ?? "";
    const result = await deleteOrderAction(locale, order.id, customerId, label);
    if (result.error) errors.push(result.error);
    else deleted++;
  }

  return { error: errors.length > 0 ? errors.join("; ") : null, deleted };
}

/** Price override for one order line — open to admin and seller (matches the
 * seller's full permission set: view/search products, change order status,
 * change price — every change lands in the log). Pass null to clear the
 * override and fall back to price_at_order. */
export async function updateOrderDiscountAction(
  locale: Locale,
  id: string,
  customerId: string,
  discountedPrice: number | null,
  label: string
): Promise<{ error: string | null }> {
  const actor = await requireStaff(locale);

  const admin = createAdminClient();

  const { data: before } = await admin.from("orders").select("discounted_price").eq("id", id).single();

  const { error } = await admin
    .from("orders")
    .update({ discounted_price: discountedPrice })
    .eq("id", id);

  if (error) return { error: error.message };

  await logAction(actor, "update", "order", label, {
    entityId: id,
    details: {
      discountedPrice: {
        before: before?.discounted_price != null ? String(before.discounted_price) : "",
        after: discountedPrice != null ? String(discountedPrice) : "",
      },
    },
  });
  revalidateOrderPaths(locale, customerId, id);
  return { error: null };
}

/** Permanently deletes an order record — admin-only, and only once the order
 * is in a terminal state (cancelled or delivered), enforced server-side so
 * this can't be reached for an order still in progress. */
export async function deleteOrderAction(
  locale: Locale,
  id: string,
  customerId: string,
  label: string
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("status").eq("id", id).single();
  if (!order) return { error: "not_found" };
  if (order.status !== "cancelled" && order.status !== "delivered") {
    return { error: "not_deletable" };
  }

  const { error } = await admin.from("orders").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAction(actor, "delete", "order", label, { entityId: id });
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
