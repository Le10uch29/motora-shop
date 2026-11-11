import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/*
 * Резерв товара под оформленные, но ещё не отправленные заказы
 * (supabase/migrations/20261111_stock_reservation.sql).
 *
 * Остаток (products.stock) списывается только при отправке. Пока заказ
 * собирают, его товар занят: на складе 25 шт, кто-то заказал 20 — другому
 * покупателю доступно 5. Витрина и корзина показывают и разрешают только
 * доступное: остаток минус резерв.
 *
 * Без SQL резерва нет (функции нет) — тогда доступно столько, сколько на
 * остатке, как раньше.
 */

/** Резерв по товарам, у которых он есть: id товара → штук. */
export async function readReservedStock(client: SupabaseClient): Promise<Map<string, number>> {
  const { data, error } = await client.rpc("reserved_stock");
  if (error || !Array.isArray(data)) return new Map();
  return new Map(
    (data as { product_id: string; reserved: number }[]).map((row) => [row.product_id, Number(row.reserved) || 0])
  );
}

/** То же для витрины — один запрос на всю отрисовку страницы. */
export const getReservedStock = cache(async (): Promise<Map<string, number>> => {
  return readReservedStock(await createClient());
});

/** Сколько можно заказать: остаток минус резерв, не меньше нуля. */
export function availableStock(productId: string, stock: number, reserved: Map<string, number>): number {
  return Math.max(0, stock - (reserved.get(productId) ?? 0));
}

/** Товары витрины, у которых `stock` — уже доступное количество. */
export function applyReserved<T extends { id: string; stock: number }>(
  items: T[],
  reserved: Map<string, number>
): T[] {
  if (reserved.size === 0) return items;
  return items.map((item) =>
    reserved.has(item.id) ? { ...item, stock: availableStock(item.id, item.stock, reserved) } : item
  );
}

/** Удобная обёртка для функций витрины. */
export async function withAvailableStock<T extends { id: string; stock: number }>(items: T[]): Promise<T[]> {
  if (items.length === 0) return items;
  return applyReserved(items, await getReservedStock());
}
