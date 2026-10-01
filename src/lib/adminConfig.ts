/** Настройки админ-панели, которых нет в базе.
 *
 * Держим их здесь, а не числами по коду: когда понадобится задавать порог
 * отдельно для склада или бренда, менять придётся одно место. */

/**
 * Остаток, ниже которого товар считается «заканчивается» (но ещё в наличии).
 *
 * Нулевой остаток — отдельное состояние: такой товар уже скрыт с витрины.
 */
export const LOW_STOCK_THRESHOLD = 5;

/** Периоды, за которые дашборд считает продажи и клиентов. */
export const DASHBOARD_PERIODS = ["today", "7d", "30d", "3m", "12m"] as const;

export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const DEFAULT_DASHBOARD_PERIOD: DashboardPeriod = "30d";

export function isDashboardPeriod(value: string | undefined): value is DashboardPeriod {
  return value !== undefined && (DASHBOARD_PERIODS as readonly string[]).includes(value);
}

/** Что показывает график продаж. */
export const SALES_METRICS = ["revenue", "orders", "units"] as const;

export type SalesMetric = (typeof SALES_METRICS)[number];

export function isSalesMetric(value: string | undefined): value is SalesMetric {
  return value !== undefined && (SALES_METRICS as readonly string[]).includes(value);
}

/**
 * Начало периода и начало предыдущего такого же периода — для сравнения
 * «столько-то процентов к предыдущему периоду».
 *
 * «Сегодня» считается от полуночи по Тбилиси, а не по времени сервера:
 * магазин живёт в этом часовом поясе, и администратор ожидает, что «сегодня»
 * сменится в его полночь.
 */
export function periodBounds(period: DashboardPeriod, now = new Date()) {
  const start = new Date(now);

  if (period === "today") {
    // Полночь в Тбилиси (UTC+4) в терминах UTC.
    const tbilisi = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    tbilisi.setUTCHours(0, 0, 0, 0);
    const from = new Date(tbilisi.getTime() - 4 * 60 * 60 * 1000);
    const length = now.getTime() - from.getTime();
    return { from, previousFrom: new Date(from.getTime() - length) };
  }

  const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "3m" ? 90 : 365;
  start.setUTCDate(start.getUTCDate() - days);
  const previousFrom = new Date(start);
  previousFrom.setUTCDate(previousFrom.getUTCDate() - days);
  return { from: start, previousFrom };
}

/** День или месяц — чем крупнее период, тем крупнее столбик графика. */
export function bucketOf(period: DashboardPeriod): "day" | "month" {
  return period === "3m" || period === "12m" ? "month" : "day";
}
