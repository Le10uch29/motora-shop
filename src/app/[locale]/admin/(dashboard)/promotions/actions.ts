"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/logs";
import { PROMO_KEYS, PROMO_LIMIT, isPromoKind } from "@/lib/promotions";
import type { Locale } from "@/i18n/locales";

/** Сохраняет подборку («Популярное» или «Новое поступление») целиком — в
 * том порядке, в каком её расставил админ.
 *
 * «Популярное» к тому же выставляет галочку «популярный» у товаров: она в
 * карточке товара и этот список — одно и то же, и расходиться им нельзя. */
export async function savePromoListAction(
  locale: Locale,
  kind: string,
  productIds: string[]
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);
  if (!isPromoKind(kind)) return { error: "invalid_kind" };

  const ids = Array.from(new Set(productIds.filter((id) => typeof id === "string" && id)));
  if (ids.length > PROMO_LIMIT) return { error: "too_many" };

  const admin = createAdminClient();

  // Только существующие товары: пока админ собирал список, товар могли удалить.
  const { data: existing } = ids.length
    ? await admin.from("products").select("id").in("id", ids)
    : { data: [] as { id: string }[] };
  const known = new Set((existing ?? []).map((row) => row.id));
  const value = ids.filter((id) => known.has(id));

  const { error } = await admin
    .from("app_settings")
    .upsert({ key: PROMO_KEYS[kind], value, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };

  if (kind === "popular") {
    await admin.from("products").update({ is_popular: false }).eq("is_popular", true);
    if (value.length > 0) await admin.from("products").update({ is_popular: true }).in("id", value);
    revalidatePath(`/${locale}/admin/products`);
  }

  await logAction(actor, "update", "product", `${PROMO_KEYS[kind]}: ${value.length}`, {
    details: { promo: kind, count: String(value.length) },
  });
  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/admin/promotions`);
  return { error: null };
}
