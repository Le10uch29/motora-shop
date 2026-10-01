import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { readAllPages } from "@/lib/supabase/paginate";
import { makeLabel } from "@/lib/products";
import { LOW_STOCK_THRESHOLD, bucketOf, periodBounds, type DashboardPeriod } from "@/lib/adminConfig";
import { STATS_SINCE_KEY } from "@/lib/dashboardSettings";
import type { LocalizedText } from "@/lib/products";
import type { Locale } from "@/i18n/locales";

/**
 * Запросы дашборда — по одной функции на блок, ничего общего с остальной
 * панелью: дашборд только читает.
 *
 * Где можно, считает Postgres (`count: "exact", head: true` не тянет строки).
 * Где нужны группировки, которых PostgREST не умеет, берём минимальный набор
 * колонок и считаем в JS — на 555 товарах и сотнях заказов это дешевле, чем
 * заводить SQL-функции в схеме.
 *
 * Выдуманных чисел здесь нет: если источника данных в базе не существует,
 * функция возвращает null, а блок показывает «Нет данных».
 */

/** Разворачивает `count` из уже собранного запроса: условия пишутся на месте
 * вызова, где они читаются, и остаются типизированными. */
async function countOf(query: PromiseLike<{ count: number | null }>): Promise<number> {
  const { count } = await query;
  return count ?? 0;
}

const EXACT = { count: "exact", head: true } as const;

// ─── 1. Состояние магазина ───────────────────────────────────────────────────

export type Overview = {
  productsTotal: number;
  inStock: number;
  outOfStock: number;
  lowStock: number;
  categories: number;
  carMakes: number;
  /** Просмотров в проекте никто не собирает — источника нет. */
  views: null;
  ordersInPeriod: number;
};

export async function getOverview(period: DashboardPeriod): Promise<Overview> {
  const supabase = await createClient();
  const { from } = periodBounds(period);

  const [productsTotal, inStock, outOfStock, lowStock, categories, ordersInPeriod, makes] =
    await Promise.all([
      countOf(supabase.from("products").select("*", EXACT)),
      countOf(supabase.from("products").select("*", EXACT).gt("stock", 0)),
      countOf(supabase.from("products").select("*", EXACT).lte("stock", 0)),
      countOf(
        supabase.from("products").select("*", EXACT).gt("stock", 0).lte("stock", LOW_STOCK_THRESHOLD)
      ),
      countOf(
        supabase.from("categories").select("*", EXACT).is("parent_id", null).eq("is_active", true)
      ),
      countOf(
        supabase
          .from("orders")
          .select("*", EXACT)
          .neq("status", "cancelled")
          .gte("created_at", await effectiveFrom(from))
      ),
      getMakeCounts(),
    ]);

  return {
    productsTotal,
    inStock,
    outOfStock,
    lowStock,
    categories,
    carMakes: makes.length,
    views: null,
    ordersInPeriod,
  };
}

// ─── Совместимость: марки и модели ───────────────────────────────────────────

/** Колонка `make` хранит все марки товара через "; " — читаем только её и
 * `model`, это две короткие строки на товар. */
const getVehicleColumns = cache(async (): Promise<{ make: string; model: string | null }[]> => {
  const supabase = await createClient();
  return readAllPages<{ make: string; model: string | null }>((from, to) =>
    supabase.from("products").select("make, model").range(from, to)
  );
});

export type MakeCount = { make: string; products: number };

/** Сколько товаров подходит каждой марке. Товар на несколько марок считается
 * в каждой из них — это и есть смысл «товаров под эту машину». */
export const getMakeCounts = cache(async (): Promise<MakeCount[]> => {
  const rows = await getVehicleColumns();
  const counts = new Map<string, number>();
  for (const row of rows) {
    for (const make of row.make.split(";").map((m) => m.trim()).filter(Boolean)) {
      counts.set(make, (counts.get(make) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([make, products]) => ({ make, products }))
    .sort((a, b) => b.products - a.products);
});

export type AutomotiveAnalytics = {
  makes: { make: string; label: string; products: number }[];
  universal: number;
  withoutModel: number;
  total: number;
};

export async function getAutomotiveAnalytics(locale: Locale): Promise<AutomotiveAnalytics> {
  const [rows, makes] = await Promise.all([getVehicleColumns(), getMakeCounts()]);
  return {
    makes: makes.slice(0, 8).map(({ make, products }) => ({
      make,
      label: makeLabel(make, locale),
      products,
    })),
    universal: rows.filter((row) => row.make.trim() === "universal").length,
    withoutModel: rows.filter((row) => !row.model?.trim()).length,
    total: rows.length,
  };
}

// ─── 2. Что требует внимания / 8. Незаконченные товары ───────────────────────

export type AttentionCounts = {
  outOfStock: number;
  lowStock: number;
  withoutPhoto: number;
  withoutCategory: number;
  withoutPrice: number;
  withoutVehicle: number;
  importConflicts: number;
};

/** Обёрнуто в cache(): эти счётчики нужны и блоку «требует внимания», и
 * «незаконченным товарам», а они рендерятся в разных Suspense — без
 * дедупликации запросы ушли бы дважды за один рендер. */
export const getAttentionCounts = cache(async (): Promise<AttentionCounts> => {
  const supabase = await createClient();

  const [outOfStock, lowStock, withoutPhoto, withoutPrice, importConflicts, links, vehicles, total] =
    await Promise.all([
      countOf(supabase.from("products").select("*", EXACT).lte("stock", 0)),
      countOf(
        supabase.from("products").select("*", EXACT).gt("stock", 0).lte("stock", LOW_STOCK_THRESHOLD)
      ),
      // `images` — массив; пустой массив и есть «фото нет».
      countOf(supabase.from("products").select("*", EXACT).eq("images", "{}")),
      countOf(supabase.from("products").select("*", EXACT).lte("price", 0)),
      countOf(supabase.from("import_conflicts").select("*", EXACT).eq("resolved", false)),
      readAllPages<{ product_id: string }>((from, to) =>
        supabase.from("product_categories").select("product_id").range(from, to)
      ),
      getVehicleColumns(),
      countOf(supabase.from("products").select("*", EXACT)),
    ]);

  const categorized = new Set(links.map((link) => link.product_id)).size;

  return {
    outOfStock,
    lowStock,
    withoutPhoto,
    withoutCategory: Math.max(0, total - categorized),
    withoutPrice,
    // Машина известна наполовину: либо марка «универсальная», либо нет модели.
    withoutVehicle: vehicles.filter((row) => row.make.trim() === "universal" || !row.model?.trim()).length,
    importConflicts,
  };
});

// ─── 3. График продаж ────────────────────────────────────────────────────────

type OrderRow = {
  created_at: string;
  status: string;
  price_at_order: number;
  discounted_price: number | null;
  quantity: number;
  product_id: string | null;
};

/** Отменённые заказы в выручку не идут. */
function lineTotal(order: OrderRow): number {
  return Number(order.discounted_price ?? order.price_at_order) * order.quantity;
}

/**
 * Дата, с которой считается статистика продаж.
 *
 * Пока идут тесты, администратор может «обнулить статистику»: заказы остаются
 * на месте, но дашборд перестаёт учитывать всё, что было до этого момента.
 * Отсутствие настройки означает «считать с самого начала».
 */
export const getStatsSince = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", STATS_SINCE_KEY)
    .maybeSingle();
  return typeof data?.value === "string" ? data.value : null;
});

/** Начало окна: позднее из «начала периода» и отсечки статистики. */
async function effectiveFrom(from: Date): Promise<string> {
  const since = await getStatsSince();
  if (!since) return from.toISOString();
  return new Date(Math.max(from.getTime(), new Date(since).getTime())).toISOString();
}

async function fetchOrders(fromIso: string, toIso?: string): Promise<OrderRow[]> {
  const supabase = await createClient();
  const since = await getStatsSince();
  // Отсечка обрезает окно и для предыдущего периода тоже, иначе сравнение
  // «к предыдущему периоду» считалось бы от выброшенных заказов.
  const start = since
    ? new Date(Math.max(new Date(fromIso).getTime(), new Date(since).getTime())).toISOString()
    : fromIso;
  if (toIso && new Date(start) >= new Date(toIso)) return [];

  return readAllPages<OrderRow>((from, to) => {
    let query = supabase
      .from("orders")
      .select("created_at, status, price_at_order, discounted_price, quantity, product_id")
      .neq("status", "cancelled")
      .gte("created_at", start);
    if (toIso) query = query.lt("created_at", toIso);
    return query.range(from, to);
  });
}

export type SalesPoint = { label: string; revenue: number; orders: number; units: number };

export type Sales = {
  revenue: number;
  orders: number;
  units: number;
  /** Изменение к предыдущему периоду в процентах; null — делить было не на что. */
  revenueChange: number | null;
  points: SalesPoint[];
};

export async function getSales(period: DashboardPeriod, locale: Locale): Promise<Sales> {
  const { from, previousFrom } = periodBounds(period);
  const [current, previous] = await Promise.all([
    fetchOrders(from.toISOString()),
    fetchOrders(previousFrom.toISOString(), from.toISOString()),
  ]);

  const bucket = bucketOf(period);
  const formatter = new Intl.DateTimeFormat(locale === "ka" ? "ka-GE" : locale === "az" ? "az-AZ" : "ru-RU", {
    ...(bucket === "month" ? { month: "short" } : { day: "2-digit", month: "2-digit" }),
    timeZone: "Asia/Tbilisi",
  });

  // Один столбик на день (или месяц) периода — включая дни без заказов, иначе
  // график соврёт о плотности продаж.
  const buckets = new Map<string, SalesPoint>();
  // График начинается не раньше отсечки: пустые дни до обнуления нарисовали бы
  // провал, которого не было.
  const cursor = new Date(await effectiveFrom(from));
  const now = new Date();
  while (cursor <= now) {
    const key =
      bucket === "month"
        ? `${cursor.getUTCFullYear()}-${cursor.getUTCMonth()}`
        : cursor.toISOString().slice(0, 10);
    if (!buckets.has(key)) {
      buckets.set(key, { label: formatter.format(cursor), revenue: 0, orders: 0, units: 0 });
    }
    if (bucket === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  for (const order of current) {
    const date = new Date(order.created_at);
    const key =
      bucket === "month"
        ? `${date.getUTCFullYear()}-${date.getUTCMonth()}`
        : date.toISOString().slice(0, 10);
    const point =
      buckets.get(key) ??
      buckets.set(key, { label: formatter.format(date), revenue: 0, orders: 0, units: 0 }).get(key)!;
    point.revenue += lineTotal(order);
    point.orders += 1;
    point.units += order.quantity;
  }

  const revenue = current.reduce((sum, order) => sum + lineTotal(order), 0);
  const previousRevenue = previous.reduce((sum, order) => sum + lineTotal(order), 0);

  return {
    revenue,
    orders: current.length,
    units: current.reduce((sum, order) => sum + order.quantity, 0),
    revenueChange:
      previousRevenue > 0 ? ((revenue - previousRevenue) / previousRevenue) * 100 : null,
    points: [...buckets.values()],
  };
}

// ─── 4. Продажи по категориям ────────────────────────────────────────────────

export type CategorySales = { label: string; units: number; revenue: number; slug: string; id: string };

export async function getCategorySales(
  period: DashboardPeriod,
  locale: Locale
): Promise<CategorySales[]> {
  const supabase = await createClient();
  const { from } = periodBounds(period);
  const orders = await fetchOrders(from.toISOString());
  const productIds = [...new Set(orders.map((o) => o.product_id).filter((id): id is string => Boolean(id)))];
  if (productIds.length === 0) return [];

  const [{ data: links }, { data: categories }] = await Promise.all([
    supabase.from("product_categories").select("product_id, category_id").in("product_id", productIds),
    supabase.from("categories").select("id, parent_id, slug, name"),
  ]);

  type Row = { id: string; parent_id: string | null; slug: string; name: LocalizedText };
  const byId = new Map((categories ?? []).map((c) => [c.id, c as Row]));

  // Продажа засчитывается основной категории верхнего уровня: администратору
  // важно, какой раздел продаётся, а не конкретная подкатегория.
  const rootOf = (categoryId: string): Row | undefined => {
    const category = byId.get(categoryId);
    if (!category) return undefined;
    return category.parent_id ? byId.get(category.parent_id) : category;
  };

  const rootByProduct = new Map<string, Row>();
  for (const link of links ?? []) {
    const root = rootOf(link.category_id);
    if (root && !rootByProduct.has(link.product_id)) rootByProduct.set(link.product_id, root);
  }

  const totals = new Map<string, CategorySales>();
  for (const order of orders) {
    if (!order.product_id) continue;
    const root = rootByProduct.get(order.product_id);
    if (!root) continue;
    const entry =
      totals.get(root.id) ??
      totals
        .set(root.id, {
          id: root.id,
          slug: root.slug,
          label: root.name[locale] || root.name.ru,
          units: 0,
          revenue: 0,
        })
        .get(root.id)!;
    entry.units += order.quantity;
    entry.revenue += lineTotal(order);
  }

  return [...totals.values()].sort((a, b) => b.units - a.units);
}

// ─── 5. Самые продаваемые запчасти ───────────────────────────────────────────

export type TopProduct = {
  id: string;
  slug: string;
  name: string;
  productCode: string;
  categoryLabel: string | null;
  sold: number;
  stock: number;
};

export async function getTopProducts(
  period: DashboardPeriod,
  locale: Locale,
  limit = 10
): Promise<TopProduct[]> {
  const supabase = await createClient();
  const { from } = periodBounds(period);
  const orders = await fetchOrders(from.toISOString());

  const sold = new Map<string, number>();
  for (const order of orders) {
    if (!order.product_id) continue;
    sold.set(order.product_id, (sold.get(order.product_id) ?? 0) + order.quantity);
  }
  const ids = [...sold.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([id]) => id);
  if (ids.length === 0) return [];

  const [{ data: products }, { data: links }, { data: categories }] = await Promise.all([
    supabase.from("products").select("id, slug, name, product_code, stock").in("id", ids),
    supabase.from("product_categories").select("product_id, category_id").in("product_id", ids),
    supabase.from("categories").select("id, name"),
  ]);

  const categoryName = new Map(
    (categories ?? []).map((c) => [c.id, (c.name as LocalizedText)[locale] || (c.name as LocalizedText).ru])
  );
  const labelByProduct = new Map<string, string>();
  for (const link of links ?? []) {
    const label = categoryName.get(link.category_id);
    if (label && !labelByProduct.has(link.product_id)) labelByProduct.set(link.product_id, label);
  }

  return ids
    .map((id) => {
      const product = (products ?? []).find((p) => p.id === id);
      if (!product) return null;
      const name = product.name as LocalizedText;
      return {
        id,
        slug: product.slug,
        name: name[locale] || name.ru,
        productCode: product.product_code ?? "",
        categoryLabel: labelByProduct.get(id) ?? null,
        sold: sold.get(id) ?? 0,
        stock: product.stock,
      };
    })
    .filter((row): row is TopProduct => row !== null);
}

// ─── 6. Excel Import Center ──────────────────────────────────────────────────

export type LastImport = {
  /** Строка, которую импорт записывает в журнал: счётчики в человеческом виде. */
  summary: string;
  staffName: string;
  createdAt: string;
} | null;

export type ImportCenter = {
  last: LastImport;
  unresolvedConflicts: number;
};

/**
 * Что известно о последнем импорте.
 *
 * Отдельной таблицы прогонов в базе нет: импорт пишет итог одной строкой в
 * журнал действий. Поэтому здесь честно показывается эта строка, дата и автор,
 * а структурированные счётчики (имя файла, строк, ошибок) появятся, когда
 * завёдем таблицу истории импортов.
 */
export async function getImportCenter(): Promise<ImportCenter> {
  const supabase = await createClient();
  const [{ data: logs }, unresolvedConflicts] = await Promise.all([
    supabase
      .from("logs")
      .select("staff_name, entity_label, created_at")
      .eq("entity_type", "product")
      .like("entity_label", "Импорт Excel%")
      .order("created_at", { ascending: false })
      .limit(1),
    countOf(supabase.from("import_conflicts").select("*", EXACT).eq("resolved", false)),
  ]);

  const row = (logs ?? [])[0];
  return {
    last: row
      ? { summary: row.entity_label, staffName: row.staff_name, createdAt: row.created_at }
      : null,
    unresolvedConflicts,
  };
}

// ─── 9. Клиенты / 10. География ──────────────────────────────────────────────

export type CustomersSummary = {
  total: number;
  newInPeriod: number;
  latest: { name: string; organization: string; city: string; createdAt: string }[];
};

export async function getCustomersSummary(period: DashboardPeriod): Promise<CustomersSummary> {
  const supabase = await createClient();
  const { from } = periodBounds(period);

  const [total, newInPeriod, { data: latest }] = await Promise.all([
    countOf(supabase.from("customers").select("*", EXACT)),
    countOf(supabase.from("customers").select("*", EXACT).gte("created_at", from.toISOString())),
    supabase
      .from("customers")
      .select("first_name, last_name, organization_name, city, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return {
    total,
    newInPeriod,
    latest: (latest ?? []).map((row) => ({
      name: `${row.first_name} ${row.last_name}`.trim(),
      organization: row.organization_name,
      city: row.city,
      createdAt: row.created_at,
    })),
  };
}

export type CitySales = { city: string; orders: number; revenue: number };

/** География берётся из города покупателя — других адресных данных у заказа
 * нет. Заказы сотрудников (у них нет карточки покупателя) в разрез не
 * попадают. */
export async function getGeography(period: DashboardPeriod): Promise<CitySales[]> {
  const supabase = await createClient();
  const { from } = periodBounds(period);
  const windowStart = await effectiveFrom(from);

  const orders = await readAllPages<{ customer_id: string; price_at_order: number; discounted_price: number | null; quantity: number }>(
    (fromRow, toRow) =>
      supabase
        .from("orders")
        .select("customer_id, price_at_order, discounted_price, quantity")
        .neq("status", "cancelled")
        .gte("created_at", windowStart)
        .range(fromRow, toRow)
  );
  if (orders.length === 0) return [];

  const { data: customers } = await supabase
    .from("customers")
    .select("id, city")
    .in("id", [...new Set(orders.map((o) => o.customer_id))]);
  const cityById = new Map((customers ?? []).map((c) => [c.id, (c.city ?? "").trim()]));

  const totals = new Map<string, CitySales>();
  for (const order of orders) {
    const city = cityById.get(order.customer_id);
    if (!city) continue;
    const entry = totals.get(city) ?? totals.set(city, { city, orders: 0, revenue: 0 }).get(city)!;
    entry.orders += 1;
    entry.revenue += Number(order.discounted_price ?? order.price_at_order) * order.quantity;
  }

  return [...totals.values()].sort((a, b) => b.revenue - a.revenue);
}
