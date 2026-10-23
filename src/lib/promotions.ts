import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Подборки товаров на главной — «Популярное» и «Новое поступление».
 *
 * Админ собирает их в разделе «Акции»: до 15 товаров в каждой, в нужном
 * порядке. Хранятся в таблице app_settings (ключ → упорядоченный список id),
 * отдельная таблица под два списка не нужна.
 *
 * Только для сервера. app_settings закрыта политикой RLS для всех, кроме
 * админа, поэтому витрина читает её сервисным клиентом — но только эти два
 * фиксированных ключа и только на чтение; наружу уходят лишь id товаров.
 */

export const PROMO_LIMIT = 15;

export const PROMO_KEYS = {
  popular: "promo_popular",
  new: "promo_new",
} as const;

export type PromoKind = keyof typeof PROMO_KEYS;

export function isPromoKind(value: string): value is PromoKind {
  return value in PROMO_KEYS;
}

/** Список id подборки, или null — подборку ещё ни разу не сохраняли (тогда
 * «Популярное» по-старому берётся из флажка «популярный» у товара). */
export const getPromoIds = cache(async (kind: PromoKind): Promise<string[] | null> => {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", PROMO_KEYS[kind])
      .maybeSingle();
    if (error || !data) return null;
    return Array.isArray(data.value)
      ? (data.value as unknown[]).filter((id): id is string => typeof id === "string").slice(0, PROMO_LIMIT)
      : null;
  } catch {
    // Нет ключа сервиса или таблицы — витрина не должна из-за этого падать.
    return null;
  }
});

/** Галочка «популярный» в карточке товара и список «Популярное» — одно и то
 * же. Сохранили товар с галочкой — он добавляется в конец списка (если есть
 * место), сняли — убирается из списка. Пока список ни разу не сохраняли,
 * главная читает саму галочку, и делать ничего не нужно. */
export async function syncPopularFromProductFlag(productId: string, isPopular: boolean): Promise<void> {
  const ids = await getPromoIds("popular");
  if (ids === null) return;
  const has = ids.includes(productId);
  let next: string[] | null = null;
  if (isPopular && !has && ids.length < PROMO_LIMIT) next = [...ids, productId];
  if (!isPopular && has) next = ids.filter((id) => id !== productId);
  if (!next) return;
  const admin = createAdminClient();
  await admin
    .from("app_settings")
    .upsert({ key: PROMO_KEYS.popular, value: next, updated_at: new Date().toISOString() });
}
