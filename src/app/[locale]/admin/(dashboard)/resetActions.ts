"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { STATS_SINCE_KEY } from "@/lib/dashboardSettings";
import { logAction } from "@/lib/logs";
import type { Locale } from "@/i18n/locales";

/**
 * Обнуление цифр дашборда на время тестов.
 *
 * Всё, что дашборд показывает про продажи — выручка, заказы, проданные штуки,
 * продажи по категориям, топ товаров, география — считается из таблицы
 * заказов. Поэтому «обнулить статистику» значит одно из двух:
 *
 * - поставить дату отсечки: заказы остаются на месте и их по-прежнему видно в
 *   разделе «Заказы», но дашборд считает только то, что сделано после неё.
 *   Обратимо — отсечку можно снять;
 * - удалить тестовые заказы совсем. Необратимо, зато в списке заказов не
 *   остаётся мусора после тестов.
 *
 * Товары, покупатели, категории и склады здесь не затрагиваются: они к цифрам
 * продаж отношения не имеют.
 *
 * Весь раздел закрыт переменной ALLOW_DATA_RESET — после запуска магазина
 * достаточно не ставить её в production.
 */

export type ResetState = {
  /** Дата отсечки или null, если статистика считается с самого начала. */
  statsSince: string | null;
  /** Сколько заказов сейчас в базе — всего и после отсечки. */
  ordersTotal: number;
  ordersCounted: number;
};

export async function isDataResetEnabled(): Promise<boolean> {
  return process.env.ALLOW_DATA_RESET === "true";
}

/** Таблицы настроек ещё нет в базе — схему не накатывали. Отличаем этот случай
 * от настоящих ошибок, чтобы вместо текста PostgREST показать, что делать. */
function isMissingSettingsTable(error: { code?: string; message: string }): boolean {
  return error.code === "PGRST205" || error.message.includes("app_settings");
}

export async function getResetState(locale: Locale): Promise<ResetState> {
  await requireAdmin(locale);
  const admin = createAdminClient();

  const { data: setting } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", STATS_SINCE_KEY)
    .maybeSingle();
  const statsSince = typeof setting?.value === "string" ? setting.value : null;

  const [{ count: ordersTotal }, { count: ordersCounted }] = await Promise.all([
    admin.from("orders").select("*", { count: "exact", head: true }),
    statsSince
      ? admin.from("orders").select("*", { count: "exact", head: true }).gte("created_at", statsSince)
      : admin.from("orders").select("*", { count: "exact", head: true }),
  ]);

  return {
    statsSince,
    ordersTotal: ordersTotal ?? 0,
    ordersCounted: ordersCounted ?? 0,
  };
}

/** Ставит отсечку «считать с этого момента» или снимает её. */
export async function setStatsSinceAction(
  locale: Locale,
  mode: "now" | "clear"
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);
  if (!(await isDataResetEnabled())) return { error: "reset_disabled" };

  const admin = createAdminClient();

  if (mode === "clear") {
    const { error } = await admin.from("app_settings").delete().eq("key", STATS_SINCE_KEY);
    if (error) return { error: isMissingSettingsTable(error) ? "settings_table_missing" : error.message };
    await logAction(actor, "update", "order", "Статистика дашборда: отсечка снята");
  } else {
    const since = new Date().toISOString();
    const { error } = await admin
      .from("app_settings")
      .upsert({ key: STATS_SINCE_KEY, value: since, updated_at: since }, { onConflict: "key" });
    if (error) return { error: isMissingSettingsTable(error) ? "settings_table_missing" : error.message };
    await logAction(actor, "update", "order", `Статистика дашборда обнулена с ${since}`);
  }

  revalidatePath(`/${locale}/admin`, "layout");
  return { error: null };
}

/**
 * Удаляет заказы — после тестов. Необратимо.
 *
 * Товары, покупатели и их учётки не затрагиваются: удаляются только строки
 * заказов.
 */
export async function deleteOrdersAction(
  locale: Locale,
  confirmation: string,
  expectedConfirmation: string
): Promise<{ error: string | null; deleted?: number }> {
  const actor = await requireAdmin(locale);
  if (!(await isDataResetEnabled())) return { error: "reset_disabled" };
  if (confirmation.trim().toLowerCase() !== expectedConfirmation.trim().toLowerCase()) {
    return { error: "confirmation_mismatch" };
  }

  const admin = createAdminClient();
  // Supabase требует явный фильтр на delete; id есть у всех строк.
  const { error, count } = await admin
    .from("orders")
    .delete({ count: "exact" })
    .not("id", "is", null);
  if (error) return { error: error.message };

  await logAction(actor, "delete", "order", `Удалены тестовые заказы: ${count ?? 0}`);
  revalidatePath(`/${locale}/admin`, "layout");
  return { error: null, deleted: count ?? 0 };
}
