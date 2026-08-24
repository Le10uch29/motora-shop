"use server";

import { createClient } from "@/lib/supabase/server";

export type PlaceOrderState = { error: string | null };

/** Turns the current cart into order rows — one per product line. Any logged-in
 * user can order (customer or staff — see schema.sql's note on orders.customer_id).
 * Runs on the caller's own session (relies on the `orderer_insert_own_orders`
 * RLS policy), same approach as `updateOwnPhotoAction`. Price/name are always
 * re-read from the DB here, never trusted from the client. */
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
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price")
    .in("id", productIds);

  if (!products || products.length === 0) return { error: "products_not_found" };

  const rows = items
    .map((item) => {
      const product = products.find((p) => p.id === item.productId);
      if (!product) return null;
      return {
        customer_id: user.id,
        product_id: product.id,
        product_name: product.name,
        price_at_order: product.price,
        quantity: Math.max(1, Math.floor(item.quantity)),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) return { error: "products_not_found" };

  const { error } = await supabase.from("orders").insert(rows);
  if (error) return { error: error.message };

  return { error: null };
}
