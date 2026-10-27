"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/logs";
import type { Locale } from "@/i18n/locales";
import type { ImportConflictRow, ProductCompletenessRow } from "./productTypes";

/* Разбор после импорта: конфликты (разные цены у повторов одного кода) и
 * товары, которым не хватает цены или кодов. */

export async function getImportConflictsAction(locale: Locale): Promise<ImportConflictRow[]> {
  await requireAdmin(locale);
  const admin = createAdminClient();

  const { data } = await admin
    .from("import_conflicts")
    .select(
      "id, product_id, product_code, origin_code, field, values, resolved_value, created_at, products(name, slug)"
    )
    .eq("resolved", false)
    .order("created_at", { ascending: false });

  return (data ?? []).map((row) => {
    const product = Array.isArray(row.products) ? row.products[0] : row.products;
    return {
      id: row.id,
      productId: row.product_id,
      productCode: row.product_code,
      originCode: row.origin_code,
      field: row.field,
      values: row.values,
      resolvedValue: row.resolved_value,
      createdAt: row.created_at,
      productName: product?.name?.[locale] ?? product?.name?.ru ?? null,
      productSlug: product?.slug ?? null,
    };
  });
}

/** Marks a logged import conflict as reviewed — doesn't touch the product
 * itself (the higher price was already applied at import time); this just
 * clears it from the admin's "needs a look" list. */
export async function resolveImportConflictAction(
  locale: Locale,
  id: string
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);
  const admin = createAdminClient();

  const { error } = await admin.from("import_conflicts").update({ resolved: true }).eq("id", id);
  if (error) return { error: error.message };

  await logAction(actor, "update", "product", `Проверен конфликт импорта: ${id}`, {});
  revalidatePath(`/${locale}/admin/products`);
  return { error: null };
}

/** Lean listing of every product's completeness-relevant fields, for the
 * "missing data" audit modal — lets an admin spot products that came out of
 * a bulk import (or manual entry) without a price/origin code/product code. */
export async function getProductsCompletenessAction(locale: Locale): Promise<ProductCompletenessRow[]> {
  await requireAdmin(locale);
  const admin = createAdminClient();

  const { data } = await admin
    .from("products")
    .select("id, product_code, origin_code, price, name")
    .order("created_at", { ascending: false });

  return (data ?? []).map((p) => ({
    id: p.id,
    productCode: p.product_code ?? "",
    originCode: p.origin_code ?? "",
    price: p.price,
    displayName: p.name?.[locale] ?? p.name?.ru ?? "",
  }));
}
