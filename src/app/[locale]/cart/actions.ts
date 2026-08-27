"use server";

import { createClient } from "@/lib/supabase/server";

export type PlaceOrderState = { error: string | null };

/** Turns the current cart into order rows — one per product line. Any logged-in
 * user can order (customer or staff — see schema.sql's note on orders.customer_id).
 * Runs on the caller's own session (relies on the `orderer_insert_own_orders`
 * RLS policy), same approach as `updateOwnPhotoAction`.
 *
 * price_at_order/product_name are intentionally NOT sent here — the
 * customer's own session only has INSERT privilege on
 * (customer_id, product_id, quantity); a DB trigger (set_order_price_from_product
 * in schema.sql) fills the price/name in from the live product row. This
 * means price integrity holds even against a direct REST call that bypasses
 * this action entirely, not just against a client that happens to behave. */
export async function placeOrderAction(
  items: { productId: string; quantity: number }[]
): Promise<PlaceOrderState> {
  if (items.length === 0) return { error: "empty_cart" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "not_authenticated" };

  const productIds = items.map((item) => item.productId);
  const { data: products } = await supabase.from("products").select("id").in("id", productIds);

  if (!products || products.length === 0) return { error: "products_not_found" };
  const validProductIds = new Set(products.map((p) => p.id));

  const rows = items
    .filter((item) => validProductIds.has(item.productId))
    .map((item) => ({
      customer_id: user.id,
      product_id: item.productId,
      quantity: Math.max(1, Math.floor(item.quantity)),
    }));

  if (rows.length === 0) return { error: "products_not_found" };

  const { error } = await supabase.from("orders").insert(rows);
  if (error) return { error: error.message };

  return { error: null };
}
