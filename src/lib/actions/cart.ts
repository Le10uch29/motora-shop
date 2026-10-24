"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getAuthIdentity } from "@/lib/supabase/authUsers";

/**
 * Корзина на сервере (таблица cart_items).
 *
 * Всё идёт сессией самого пользователя: политика own_cart_items пускает
 * только к своим строкам, так что чужую корзину отсюда не прочитать и не
 * изменить, даже подставив чужой id.
 */

/** Сколько дней заказанные товары остаются в корзине списком «Заказано». */
const ORDERED_KEEP_DAYS = 3;
const MAX_QUANTITY = 99999;

export type CartItem = { productId: string; quantity: number };
export type OrderedCartItem = {
  id: string;
  productId: string;
  quantity: number;
  orderedAt: string;
  orderNumber: number | null;
};
export type CartSnapshot = {
  items: CartItem[];
  ordered: OrderedCartItem[];
  /** Таблицы cart_items ещё нет (SQL из schema.sql не выполнен). */
  unavailable?: boolean;
};

type Session = { supabase: SupabaseClient; userId: string };

async function session(): Promise<Session | null> {
  const supabase = await createClient();
  const user = await getAuthIdentity(supabase);
  return user ? { supabase, userId: user.id } : null;
}

function cleanQuantity(quantity: number): number {
  return Math.min(MAX_QUANTITY, Math.max(0, Math.floor(Number(quantity) || 0)));
}

function isMissingTable(message: string | undefined): boolean {
  return Boolean(message && (message.includes("cart_items") || message.includes("PGRST205")));
}

/** Корзина целиком. Заодно удаляет заказанное старше 3 дней. */
export async function getCartAction(): Promise<CartSnapshot> {
  const s = await session();
  if (!s) return { items: [], ordered: [] };

  const cutoff = new Date(Date.now() - ORDERED_KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await s.supabase.from("cart_items").delete().eq("user_id", s.userId).lt("ordered_at", cutoff);

  const { data, error } = await s.supabase
    .from("cart_items")
    .select("id, product_id, quantity, ordered_at, order_number")
    .eq("user_id", s.userId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) return { items: [], ordered: [], unavailable: isMissingTable(error.message) || undefined };

  const rows = data ?? [];
  return {
    items: rows
      .filter((row) => !row.ordered_at)
      .map((row) => ({ productId: row.product_id, quantity: row.quantity })),
    ordered: rows
      .filter((row) => row.ordered_at)
      .map((row) => ({
        id: row.id,
        productId: row.product_id,
        quantity: row.quantity,
        orderedAt: row.ordered_at!,
        orderNumber: row.order_number ?? null,
      }))
      .sort((a, b) => b.orderedAt.localeCompare(a.orderedAt)),
  };
}

/** Ставит количество товара в корзине; 0 — убрать. `add` — прибавить к тому,
 * что уже лежит (кнопка «В корзину»), а не заменить. */
export async function setCartItemAction(
  productId: string,
  quantity: number,
  add = false
): Promise<{ error: string | null }> {
  const s = await session();
  if (!s) return { error: "not_authenticated" };
  const amount = cleanQuantity(quantity);

  const { data: existing } = await s.supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("user_id", s.userId)
    .eq("product_id", productId)
    .is("ordered_at", null)
    .maybeSingle();

  const next = Math.min(MAX_QUANTITY, add ? (existing?.quantity ?? 0) + amount : amount);
  if (next <= 0) {
    if (!existing) return { error: null };
    const { error } = await s.supabase.from("cart_items").delete().eq("id", existing.id);
    return { error: error?.message ?? null };
  }
  const { error } = existing
    ? await s.supabase.from("cart_items").update({ quantity: next }).eq("id", existing.id)
    : await s.supabase.from("cart_items").insert({ user_id: s.userId, product_id: productId, quantity: next });
  return { error: error?.message ?? null };
}

/** Убирает уже заказанный товар из списка «Заказано» — не дожидаясь 3 дней. */
export async function removeOrderedCartItemAction(id: string): Promise<{ error: string | null }> {
  const s = await session();
  if (!s) return { error: "not_authenticated" };
  const { error } = await s.supabase
    .from("cart_items")
    .delete()
    .eq("id", id)
    .eq("user_id", s.userId)
    .not("ordered_at", "is", null);
  return { error: error?.message ?? null };
}

/** «Очистить корзину» — только то, что ещё не заказано. */
export async function clearCartAction(): Promise<{ error: string | null }> {
  const s = await session();
  if (!s) return { error: "not_authenticated" };
  const { error } = await s.supabase
    .from("cart_items")
    .delete()
    .eq("user_id", s.userId)
    .is("ordered_at", null);
  return { error: error?.message ?? null };
}

/** Переносит корзину, оставшуюся в localStorage этого браузера с прежних
 * времён, на сервер — один раз, чтобы при переходе ничего не пропало.
 * Количество складывается с тем, что уже лежит на сервере. */
export async function importLocalCartAction(items: CartItem[]): Promise<{ error: string | null }> {
  for (const item of items.slice(0, 200)) {
    if (typeof item?.productId !== "string") continue;
    const { error } = await setCartItemAction(item.productId, item.quantity, true);
    if (error) return { error };
  }
  return { error: null };
}
