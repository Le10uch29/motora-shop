import type { SupabaseClient } from "@supabase/supabase-js";
import { readAllPages } from "@/lib/supabase/paginate";

/*
 * Возвраты в выручке и в истории покупок.
 *
 * Возврат (orders.returned_quantity, см. миграцию 20261110_order_returns_
 * import_merge.sql) уменьшает то, что покупатель купил: выручка, проданные
 * штуки и история покупок считаются от «купил минус вернул», а позиция,
 * возвращённая целиком, из истории пропадает.
 *
 * Возвращённые строки читаются отдельным маленьким запросом (их единицы), а
 * не добавляются в основные выборки: пока SQL не выполнен, колонки нет — и
 * тогда этот запрос просто ничего не находит, а остальное считается как
 * раньше, без ошибки.
 */

/** Сколько вернули по каждой строке заказа (id строки → штук); только
 * строки, по которым что-то вернули. */
export async function readReturnedQuantities(
  client: SupabaseClient,
  scope: { customerId?: string; orderNumber?: number } = {}
): Promise<Map<string, number>> {
  const rows = await readAllPages<{ id: string; returned_quantity: number }>((from, to) => {
    let query = client.from("orders").select("id, returned_quantity").gt("returned_quantity", 0);
    if (scope.customerId) query = query.eq("customer_id", scope.customerId);
    if (scope.orderNumber != null) query = query.eq("order_number", scope.orderNumber);
    return query.order("id").range(from, to);
  });
  return new Map(rows.map((row) => [row.id, row.returned_quantity]));
}

/** Сколько осталось у покупателя: заказано минус возвращено, не меньше нуля. */
export function keptQuantity(id: string, quantity: number, returned: Map<string, number>): number {
  return Math.max(0, quantity - (returned.get(id) ?? 0));
}

/** Строки заказов за вычетом возвращённого; возвращённые целиком — убраны. */
export function withoutReturned<T extends { id: string; quantity: number }>(
  rows: T[],
  returned: Map<string, number>
): T[] {
  if (returned.size === 0) return rows;
  return rows
    .map((row) => ({ ...row, quantity: keptQuantity(row.id, row.quantity, returned) }))
    .filter((row) => row.quantity > 0);
}
