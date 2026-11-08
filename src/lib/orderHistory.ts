import { createClient } from "@/lib/supabase/server";
import { getAuthIdentity } from "@/lib/supabase/authUsers";
import type { Locale } from "@/i18n/locales";

/**
 * История заказов покупателя (страница корзины).
 *
 * Читается его собственной сессией — политика orderer_read_own_orders пускает
 * только к своим заказам. «Удалённые» из истории заказы не удаляются из базы:
 * у них стоит orders.hidden_by_customer_at, и здесь они просто не показываются.
 * В админке, аналитике и графиках такие заказы остаются как были.
 */

export type OrderHistoryLine = {
  id: string;
  productName: string;
  productCode: string | null;
  productSlug: string | null;
  image: string | null;
  quantity: number;
  /** Цена за штуку с учётом скидки, если продавец её поставил. */
  unitPrice: number;
  status: string;
};

export type OrderHistoryEntry = {
  orderNumber: number;
  createdAt: string;
  /** null — позиции в разных статусах (например, часть отменили). */
  status: string | null;
  /** Сумма без отменённых позиций. */
  total: number;
  lines: OrderHistoryLine[];
};

export type OrderHistory = {
  orders: OrderHistoryEntry[];
  /** false — колонки hidden_by_customer_at ещё нет (SQL не выполнен), и
   * удалять из истории пока нельзя. */
  canDelete: boolean;
};

type ProductRef = { slug: string; product_code: string | null; images: string[] | null };
type Row = {
  id: string;
  order_number: number;
  created_at: string;
  product_name: Record<string, string> | null;
  price_at_order: number;
  discounted_price: number | null;
  quantity: number;
  status: string;
  line_number: number | null;
  products: ProductRef | ProductRef[] | null;
};

const SELECT =
  "id, order_number, created_at, product_name, price_at_order, discounted_price, quantity, status, line_number, products(slug, product_code, images)";

export const HIDDEN_COLUMN = "hidden_by_customer_at";

export async function getMyOrderHistory(locale: Locale): Promise<OrderHistory> {
  const supabase = await createClient();
  const user = await getAuthIdentity(supabase);
  if (!user) return { orders: [], canDelete: false };
  const userId = user.id;

  async function readAll(filterHidden: boolean): Promise<{ rows: Row[]; error: string | null }> {
    const rows: Row[] = [];
    for (let from = 0; ; from += 1000) {
      let query = supabase.from("orders").select(SELECT).eq("customer_id", userId);
      if (filterHidden) query = query.is(HIDDEN_COLUMN, null);
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, from + 999);
      if (error) return { rows, error: error.message };
      rows.push(...((data ?? []) as unknown as Row[]));
      if (!data || data.length < 1000) break;
    }
    return { rows, error: null };
  }

  let canDelete = true;
  let result = await readAll(true);
  // Колонки ещё нет — показываем историю целиком, без кнопок удаления.
  if (result.error && result.error.includes(HIDDEN_COLUMN)) {
    canDelete = false;
    result = await readAll(false);
  }
  if (result.error) return { orders: [], canDelete: false };

  type Group = OrderHistoryEntry & { statuses: Set<string>; position: Map<string, number> };
  const byNumber = new Map<number, Group>();
  for (const row of result.rows) {
    let entry = byNumber.get(row.order_number);
    if (!entry) {
      entry = {
        orderNumber: row.order_number,
        createdAt: row.created_at,
        status: null,
        total: 0,
        lines: [],
        statuses: new Set(),
        position: new Map(),
      };
      byNumber.set(row.order_number, entry);
    }
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    const unitPrice = Number(row.discounted_price ?? row.price_at_order);
    entry.lines.push({
      id: row.id,
      productName: row.product_name?.[locale] || row.product_name?.ru || "—",
      productCode: product?.product_code ?? null,
      productSlug: product?.slug ?? null,
      image: product?.images?.[0] ?? null,
      quantity: row.quantity,
      unitPrice,
      status: row.status,
    });
    entry.position.set(row.id, row.line_number ?? Number.MAX_SAFE_INTEGER);
    entry.statuses.add(row.status);
    if (row.status !== "cancelled") entry.total += unitPrice * row.quantity;
    if (row.created_at < entry.createdAt) entry.createdAt = row.created_at;
  }

  const orders = [...byNumber.values()]
    .map(({ statuses, position, ...entry }) => ({
      ...entry,
      status: statuses.size === 1 ? [...statuses][0] : null,
      // Тот же порядок, что был в корзине при оформлении.
      lines: entry.lines.sort((a, b) => position.get(a.id)! - position.get(b.id)!),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.orderNumber - a.orderNumber);

  return { orders, canDelete };
}
