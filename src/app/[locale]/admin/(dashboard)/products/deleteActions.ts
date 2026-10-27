"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/logs";
import { PRODUCTS_CACHE_TAG } from "@/lib/productFilterMeta";
import type { Locale } from "@/i18n/locales";

export async function deleteProductAction(
  locale: Locale,
  id: string,
  label: string
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);

  const admin = createAdminClient();
  const { error } = await admin.from("products").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAction(actor, "delete", "product", label, { entityId: id });
  revalidatePath(`/${locale}/admin/products`);
  revalidatePath(`/${locale}/catalog`);
  updateTag(PRODUCTS_CACHE_TAG);
  revalidatePath(`/${locale}`);
  return { error: null };
}

export async function deleteProductsAction(
  locale: Locale,
  ids: string[]
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);
  if (ids.length === 0) return { error: null };

  const admin = createAdminClient();
  const { error, count } = await admin.from("products").delete({ count: "exact" }).in("id", ids);
  if (error) return { error: error.message };

  await logAction(actor, "delete", "product", `Массовое удаление: ${count ?? ids.length} товаров`, {});
  revalidatePath(`/${locale}/admin/products`);
  revalidatePath(`/${locale}/catalog`);
  updateTag(PRODUCTS_CACHE_TAG);
  revalidatePath(`/${locale}`);
  return { error: null };
}

/** Wipes the entire product catalog — admin-only, irreversible. The client
 * confirms the exact count with the admin before ever calling this. */
export async function deleteAllProductsAction(locale: Locale): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);

  const admin = createAdminClient();
  // Supabase requires an explicit filter on delete; `id is not null` is
  // always true for every row (id is the primary key), so this deletes all.
  const { error, count } = await admin
    .from("products")
    .delete({ count: "exact" })
    .not("id", "is", null);
  if (error) return { error: error.message };

  await logAction(actor, "delete", "product", `Удалены все товары: ${count ?? 0}`, {});
  revalidatePath(`/${locale}/admin/products`);
  revalidatePath(`/${locale}/catalog`);
  updateTag(PRODUCTS_CACHE_TAG);
  revalidatePath(`/${locale}`);
  return { error: null };
}

/** Deletes every product with nothing in stock (stock 0 or below). Orders that
 * included one keep their line, marked as a deleted product, as with any other
 * product deletion. */
export async function deleteZeroStockProductsAction(locale: Locale): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);

  const admin = createAdminClient();
  const { error, count } = await admin
    .from("products")
    .delete({ count: "exact" })
    .lte("stock", 0);
  if (error) return { error: error.message };

  await logAction(actor, "delete", "product", `Удалены товары с нулевым остатком: ${count ?? 0}`, {});
  revalidatePath(`/${locale}/admin/products`);
  revalidatePath(`/${locale}/catalog`);
  updateTag(PRODUCTS_CACHE_TAG);
  revalidatePath(`/${locale}`);
  return { error: null };
}
