"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/authUsers";

export type PlaceOrderState = { error: string | null };

/** Схему обновляют вручную, и столбец line_number может появиться позже
 * кода — это распознаёт тот случай. */
function isMissingLineNumber(message: string): boolean {
  return message.includes("line_number");
}

/** Turns the current cart into order rows — one per product line, all sharing
 * a single order number. The whole cart is sent as one insert on purpose: the
 * orders_set_order_number trigger gives every row of one insert the same
 * number, so a checkout of five products is order №100014, not five separate
 * orders. Splitting this into per-item inserts would hand each item its own
 * number again. Any logged-in user can order (customer or staff — see
 * schema.sql's note on orders.customer_id).
 * Runs on the caller's own session (relies on the `orderer_insert_own_orders`
 * RLS policy).
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
  const user = await getAuthUser(supabase);
  if (!user) return { error: "not_authenticated" };

  const productIds = items.map((item) => item.productId);
  // Out of stock counts as not orderable, exactly as it counts as not visible
  // in the shop: a line that sold out between adding it and checking out is
  // dropped here rather than ordered.
  const { data: products } = await supabase
    .from("products")
    .select("id")
    .in("id", productIds)
    .gt("stock", 0);

  if (!products || products.length === 0) return { error: "products_not_found" };
  const validProductIds = new Set(products.map((p) => p.id));

  const rows = items
    .filter((item) => validProductIds.has(item.productId))
    .map((item, index) => ({
      customer_id: user.id,
      product_id: item.productId,
      quantity: Math.max(1, Math.floor(item.quantity)),
      // Порядок позиций в корзине. Все строки одного оформления создаются
      // одним INSERT и получают одинаковый created_at, так что без явного
      // номера заказ показывался в произвольном порядке и не совпадал с тем,
      // что покупатель видел в корзине.
      line_number: index + 1,
    }));

  if (rows.length === 0) return { error: "products_not_found" };

  const { error } = await supabase.from("orders").insert(rows);
  // Столбца может ещё не быть, если схема не обновлена — заказ важнее порядка
  // строк, поэтому повторяем вставку без него.
  if (error && isMissingLineNumber(error.message)) {
    const { error: retry } = await supabase
      .from("orders")
      .insert(
        rows.map((row) => ({
          customer_id: row.customer_id,
          product_id: row.product_id,
          quantity: row.quantity,
        }))
      );
    return { error: retry ? retry.message : null };
  }
  if (error) return { error: error.message };

  return { error: null };
}
