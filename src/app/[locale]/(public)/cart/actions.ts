"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/supabase/authUsers";
import { availableStock, readReservedStock } from "@/lib/stockReservation";

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
export async function placeOrderAction(): Promise<PlaceOrderState> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "not_authenticated" };

  // Заказывается то, что лежит в корзине на сервере, — а не то, что прислал
  // браузер: корзину могли поменять на другом устройстве.
  const { data: cartRows, error: cartError } = await supabase
    .from("cart_items")
    .select("id, product_id, quantity")
    .eq("user_id", user.id)
    .is("ordered_at", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (cartError) return { error: cartError.message };
  const items = (cartRows ?? []).map((row) => ({ productId: row.product_id, quantity: row.quantity }));
  if (items.length === 0) return { error: "empty_cart" };

  const productIds = items.map((item) => item.productId);
  // Out of stock counts as not orderable, exactly as it counts as not visible
  // in the shop: a line that sold out between adding it and checking out is
  // dropped here rather than ordered.
  const [{ data: products }, reserved] = await Promise.all([
    supabase.from("products").select("id, stock").in("id", productIds).gt("stock", 0),
    readReservedStock(supabase),
  ]);

  if (!products || products.length === 0) return { error: "products_not_found" };
  const validProductIds = new Set(products.map((p) => p.id));

  // Больше доступного не заказать: доступно = остаток минус то, что занято
  // неотправленными заказами (на складе 25, кто-то заказал 20 — здесь не
  // больше 5). Если в корзине больше, корзина уменьшается до доступного, и
  // покупатель видит это до того, как заказ уйдёт, — молча урезать заказ
  // было бы хуже.
  const stockById = new Map(products.map((p) => [p.id, p.stock as number]));
  let changed = false;
  for (const row of cartRows ?? []) {
    const stock = stockById.get(row.product_id);
    if (stock === undefined) continue;
    const available = availableStock(row.product_id, stock, reserved);
    if (row.quantity <= available) continue;
    changed = true;
    if (available > 0) await supabase.from("cart_items").update({ quantity: available }).eq("id", row.id);
    else await supabase.from("cart_items").delete().eq("id", row.id);
  }
  if (changed) return { error: "stock_changed" };

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

  let { data: inserted, error } = await supabase.from("orders").insert(rows).select("order_number");
  // Столбца может ещё не быть, если схема не обновлена — заказ важнее порядка
  // строк, поэтому повторяем вставку без него.
  if (error && isMissingLineNumber(error.message)) {
    ({ data: inserted, error } = await supabase
      .from("orders")
      .insert(
        rows.map((row) => ({
          customer_id: row.customer_id,
          product_id: row.product_id,
          quantity: row.quantity,
        }))
      )
      .select("order_number"));
  }
  // Кто-то оформил тот же товар секундой раньше — база (триггер резерва) не
  // дала заказать больше доступного. Корзина покажет новое доступное.
  if (error && error.message.includes("insufficient_stock")) return { error: "stock_changed" };
  if (error) return { error: error.message };

  // Заказанное не исчезает из корзины сразу: оно переходит в список
  // «Заказано» и само удаляется через 3 дня (см. getCartAction). Помечаются
  // только реально заказанные строки — закончившийся товар остаётся в корзине.
  await supabase
    .from("cart_items")
    .update({ ordered_at: new Date().toISOString(), order_number: inserted?.[0]?.order_number ?? null })
    .eq("user_id", user.id)
    .is("ordered_at", null)
    .in("product_id", rows.map((row) => row.product_id));

  return { error: null };
}

/**
 * Убирает заказ (или все заказы, если orderNumber = null) из истории
 * покупателя в корзине.
 *
 * Заказ из базы НЕ удаляется: ставится orders.hidden_by_customer_at, и
 * история его больше не показывает. В админке, аналитике и графиках заказ
 * остаётся как был. Своей сессией покупатель строки заказов менять не может
 * (grant update на orders — только служебные столбцы), поэтому запись идёт
 * серверным ключом — строго по заказам вошедшего пользователя.
 */
export async function hideOrderHistoryAction(
  locale: string,
  orderNumber: number | null
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return { error: "not_authenticated" };
  if (orderNumber !== null && !Number.isInteger(orderNumber)) return { error: "bad_order" };

  const admin = createAdminClient();
  let query = admin
    .from("orders")
    .update({ hidden_by_customer_at: new Date().toISOString() })
    .eq("customer_id", user.id)
    .is("hidden_by_customer_at", null);
  if (orderNumber !== null) query = query.eq("order_number", orderNumber);
  const { error } = await query;
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/cart`);
  return { error: null };
}
