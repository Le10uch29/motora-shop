"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/paginate";
import { logAction } from "@/lib/logs";
import { CATEGORIES_CACHE_TAG } from "@/lib/categories";
import { slugify, uniqueSlug } from "@/lib/slug";
import { isLocale, type Locale } from "@/i18n/locales";
import type { LocalizedText } from "@/lib/products";

export type CategoryActionState = { error: string | null };

function readLocale(formData: FormData): Locale {
  const raw = String(formData.get("locale") ?? "");
  if (!isLocale(raw)) throw new Error("Missing/invalid locale in form submission");
  return raw;
}

function readLocalized(formData: FormData, prefix: string): LocalizedText | null {
  const ru = String(formData.get(`${prefix}Ru`) ?? "").trim();
  const az = String(formData.get(`${prefix}Az`) ?? "").trim();
  const ka = String(formData.get(`${prefix}Ka`) ?? "").trim();
  if (!ru && !az && !ka) return null;
  // A language left blank falls back to whichever one was filled in, so a
  // category never shows up nameless in one of the three shop languages.
  const any = ru || az || ka;
  return { ru: ru || any, az: az || any, ka: ka || any };
}

/** Category photos live in the same bucket as product and brand images, under
 * their own prefix — same upload path, no second storage system. */
async function uploadImage(
  admin: ReturnType<typeof createAdminClient>,
  file: FormDataEntryValue | null
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  const ext = file.name.split(".").pop() || "jpg";
  const path = `categories/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await admin.storage.from("product-media").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });
  if (error) throw new Error(error.message);
  return admin.storage.from("product-media").getPublicUrl(path).data.publicUrl;
}

/** Revalidates everything a category change can show up on: the admin pages,
 * the catalog and its category pages, and the home page's category block. */
function revalidateCategories(locale: Locale) {
  updateTag(CATEGORIES_CACHE_TAG);
  revalidatePath(`/${locale}/admin/categories`, "layout");
  revalidatePath(`/${locale}/catalog`, "layout");
  revalidatePath(`/${locale}`);
}

async function takenSlugs(admin: ReturnType<typeof createAdminClient>, exceptId?: string) {
  const { data } = await admin.from("categories").select("id, slug");
  return (data ?? []).filter((row) => row.id !== exceptId).map((row) => row.slug);
}

type CategoryFields = {
  name: LocalizedText;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  description: LocalizedText | null;
  metaTitle: LocalizedText | null;
  metaDescription: LocalizedText | null;
};

function readFields(formData: FormData): CategoryFields | null {
  const name = readLocalized(formData, "name");
  if (!name) return null;
  const sortOrderRaw = String(formData.get("sortOrder") ?? "").trim();
  return {
    name,
    // An empty slug is made from the name; a typed one is still normalized, so
    // nothing but lowercase latin and dashes can reach the URL.
    slug: slugify(String(formData.get("slug") ?? "").trim() || name.ru),
    sortOrder: Number(sortOrderRaw) || 0,
    isActive: formData.get("isActive") === "on",
    description: readLocalized(formData, "description"),
    metaTitle: readLocalized(formData, "metaTitle"),
    metaDescription: readLocalized(formData, "metaDescription"),
  };
}

function toRow(fields: CategoryFields) {
  return {
    name: fields.name,
    slug: fields.slug,
    sort_order: fields.sortOrder,
    is_active: fields.isActive,
    description: fields.description,
    meta_title: fields.metaTitle,
    meta_description: fields.metaDescription,
  };
}

export async function createCategoryAction(
  prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const locale = readLocale(formData);
  const actor = await requireAdmin(locale);

  const fields = readFields(formData);
  if (!fields) return { error: "missing_fields" };
  if (!fields.slug) return { error: "slug_required" };

  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const admin = createAdminClient();

  let imageUrl: string | null = null;
  try {
    imageUrl = await uploadImage(admin, formData.get("image"));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "upload_failed" };
  }

  const { error } = await admin.from("categories").insert({
    ...toRow(fields),
    slug: uniqueSlug(fields.slug, await takenSlugs(admin)),
    parent_id: parentIdRaw || null,
    image_url: imageUrl,
  });
  if (error) return { error: error.message };

  await logAction(actor, "create", "category", fields.name.ru);
  revalidateCategories(locale);
  return { error: null };
}

export async function updateCategoryAction(
  prevState: CategoryActionState,
  formData: FormData
): Promise<CategoryActionState> {
  const locale = readLocale(formData);
  const actor = await requireAdmin(locale);

  const id = String(formData.get("id") ?? "").trim();
  const fields = readFields(formData);
  if (!id || !fields) return { error: "missing_fields" };
  if (!fields.slug) return { error: "slug_required" };

  const admin = createAdminClient();

  let imageUrl: string | null = null;
  try {
    imageUrl = await uploadImage(admin, formData.get("image"));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "upload_failed" };
  }

  const { error } = await admin
    .from("categories")
    .update({
      ...toRow(fields),
      slug: uniqueSlug(fields.slug, await takenSlugs(admin, id)),
      // A photo is only replaced when a new one was actually picked —
      // reopening the form and saving keeps the current one.
      ...(imageUrl ? { image_url: imageUrl } : {}),
    })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAction(actor, "update", "category", fields.name.ru, { entityId: id });
  revalidateCategories(locale);
  return { error: null };
}

/**
 * Shows or hides a category on the storefront.
 *
 * Hiding takes the category out of the catalog sidebar, off the home page and
 * 404s its own page — but it touches nothing else: its products keep their
 * links, stay in the shop and are still found through search and "Все
 * товары". It's the section that disappears, not the goods.
 */
export async function setCategoryActiveAction(
  locale: Locale,
  id: string,
  isActive: boolean
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);
  const admin = createAdminClient();

  const { data: category, error } = await admin
    .from("categories")
    .update({ is_active: isActive })
    .eq("id", id)
    .select("name")
    .single();
  if (error) return { error: error.message };

  await logAction(actor, "update", "category", category?.name?.ru ?? id, {
    entityId: id,
    details: { isActive },
  });
  revalidateCategories(locale);
  return { error: null };
}

/** What to do with the products of a category being deleted. The products
 * themselves are never deleted — the only question is where they end up. */
export type DeleteCategoryMode = "uncategorize" | "move";

/**
 * Deletes a category (and, for a top-level one, its subcategories with it).
 *
 * "uncategorize" drops the links and leaves the products with no category, so
 * they stay in the shop and show up under "Все товары". "move" re-files them
 * under another category first. Either way `on delete cascade` only ever
 * reaches the link rows, never a product.
 */
export async function deleteCategoryAction(
  locale: Locale,
  id: string,
  label: string,
  mode: DeleteCategoryMode,
  targetCategoryId?: string
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);
  const admin = createAdminClient();

  const { data: children } = await admin.from("categories").select("id").eq("parent_id", id);
  const doomedIds = [id, ...(children ?? []).map((c) => c.id)];

  if (mode === "move") {
    if (!targetCategoryId) return { error: "missing_target" };
    if (doomedIds.includes(targetCategoryId)) return { error: "target_inside_deleted" };

    const links = await readAllPages<{ product_id: string }>((from, to) =>
      admin.from("product_categories").select("product_id").in("category_id", doomedIds).range(from, to)
    );
    const productIds = Array.from(new Set(links.map((link) => link.product_id)));
    if (productIds.length > 0) {
      const { error } = await attachProducts(admin, productIds, targetCategoryId);
      if (error) return { error };
    }
  }

  // The links to the deleted categories go with them (cascade); the products
  // stay. Deleting the row is enough — no delete on products anywhere here.
  const { error } = await admin.from("categories").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAction(actor, "delete", "category", label, { entityId: id, details: { mode } });
  revalidateCategories(locale);
  return { error: null };
}

/**
 * Where a product filed under `categoryId` actually ends up.
 *
 * Picking a top-level category means "this category, subcategory not stated",
 * which is exactly what its "Разное" is for — the same rule the Excel import
 * follows. A category whose "Разное" was deleted by hand keeps the product on
 * itself rather than losing it.
 */
async function resolveTargetCategory(
  admin: ReturnType<typeof createAdminClient>,
  categoryId: string
): Promise<string> {
  const { data: category } = await admin
    .from("categories")
    .select("id, parent_id")
    .eq("id", categoryId)
    .maybeSingle();
  if (!category || category.parent_id !== null) return categoryId;

  const { data: fallback } = await admin
    .from("categories")
    .select("id")
    .eq("parent_id", categoryId)
    .eq("is_default", true)
    .maybeSingle();
  return fallback?.id ?? categoryId;
}

/** Links products to a category, skipping the ones already there, and makes
 * it the primary category of every product that hasn't got one — so a product
 * filed for the first time gets its main category without anyone choosing. */
async function attachProducts(
  admin: ReturnType<typeof createAdminClient>,
  productIds: string[],
  targetId: string
): Promise<{ error: string | null }> {
  if (productIds.length === 0) return { error: null };
  const categoryId = await resolveTargetCategory(admin, targetId);

  const existing = await readAllPages<{ product_id: string; category_id: string; is_primary: boolean }>(
    (from, to) =>
      admin
        .from("product_categories")
        .select("product_id, category_id, is_primary")
        .in("product_id", productIds)
        .range(from, to)
  );
  const alreadyHere = new Set(
    existing.filter((row) => row.category_id === categoryId).map((row) => row.product_id)
  );
  const hasPrimary = new Set(existing.filter((row) => row.is_primary).map((row) => row.product_id));

  const rows = productIds
    .filter((productId) => !alreadyHere.has(productId))
    .map((productId) => ({
      product_id: productId,
      category_id: categoryId,
      is_primary: !hasPrimary.has(productId),
    }));
  if (rows.length === 0) return { error: null };

  const { error } = await admin.from("product_categories").insert(rows);
  return { error: error?.message ?? null };
}

export async function addProductsToCategoryAction(
  locale: Locale,
  categoryId: string,
  productIds: string[]
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);
  const admin = createAdminClient();

  const { error } = await attachProducts(admin, productIds, categoryId);
  if (error) return { error };

  await logAction(actor, "update", "category", `Товаров добавлено в категорию: ${productIds.length}`, {
    entityId: categoryId,
  });
  revalidateCategories(locale);
  return { error: null };
}

/**
 * Moves a product from one category to another.
 *
 * The product itself is untouched — only the link moves, and it keeps being
 * the primary one if it was. Moving onto a category the product is already in
 * just drops the old link instead of failing on the unique constraint.
 */
export async function moveProductAction(
  locale: Locale,
  productId: string,
  fromCategoryId: string,
  requestedCategoryId: string
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);
  const admin = createAdminClient();
  const toCategoryId = await resolveTargetCategory(admin, requestedCategoryId);
  if (fromCategoryId === toCategoryId) return { error: null };

  const { data: rows } = await admin
    .from("product_categories")
    .select("category_id, is_primary")
    .eq("product_id", productId);
  const current = (rows ?? []).find((row) => row.category_id === fromCategoryId);
  const target = (rows ?? []).find((row) => row.category_id === toCategoryId);

  const { error: deleteError } = await admin
    .from("product_categories")
    .delete()
    .eq("product_id", productId)
    .eq("category_id", fromCategoryId);
  if (deleteError) return { error: deleteError.message };

  const keepsPrimary = current?.is_primary ?? false;
  if (target) {
    if (keepsPrimary && !target.is_primary) {
      const { error } = await admin
        .from("product_categories")
        .update({ is_primary: true })
        .eq("product_id", productId)
        .eq("category_id", toCategoryId);
      if (error) return { error: error.message };
    }
  } else {
    const { error } = await admin
      .from("product_categories")
      .insert({ product_id: productId, category_id: toCategoryId, is_primary: keepsPrimary });
    if (error) return { error: error.message };
  }

  await logAction(actor, "update", "category", "Товар перемещён между категориями", {
    entityId: toCategoryId,
    details: { productId, from: fromCategoryId, to: toCategoryId },
  });
  revalidateCategories(locale);
  return { error: null };
}

/** Unlinks a product from a category. The product stays in the catalog; with
 * no categories left it simply shows up under "Все товары". */
export async function detachProductAction(
  locale: Locale,
  productId: string,
  categoryId: string
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);
  const admin = createAdminClient();

  const { error } = await admin
    .from("product_categories")
    .delete()
    .eq("product_id", productId)
    .eq("category_id", categoryId);
  if (error) return { error: error.message };

  await logAction(actor, "update", "category", "Товар убран из категории", {
    entityId: categoryId,
    details: { productId },
  });
  revalidateCategories(locale);
  return { error: null };
}

export type ProductSearchResult = {
  id: string;
  productCode: string;
  originCode: string;
  displayName: string;
  make: string;
  model: string;
  alreadyInCategory: boolean;
};

/** Search for the "add an existing product" picker: by APLUS KOD, OEM code or
 * name, the same fields the admin product list searches on. Never creates a
 * product — this only ever links one that already exists. */
export async function searchProductsForCategoryAction(
  locale: Locale,
  categoryId: string,
  query: string
): Promise<ProductSearchResult[]> {
  await requireAdmin(locale);
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const admin = createAdminClient();
  // PostgREST's or-filter breaks on these characters in a raw value.
  const safe = trimmed.replace(/[,()]/g, "");
  const { data } = await admin
    .from("products")
    .select("id, product_code, origin_code, name, make, model")
    .or(
      `name->>${locale}.ilike.%${safe}%,product_code.ilike.%${safe}%,origin_code.ilike.%${safe}%,make.ilike.%${safe}%,model.ilike.%${safe}%`
    )
    .limit(20);

  const ids = (data ?? []).map((row) => row.id);
  const { data: links } = ids.length
    ? await admin
        .from("product_categories")
        .select("product_id")
        .eq("category_id", categoryId)
        .in("product_id", ids)
    : { data: [] };
  const here = new Set((links ?? []).map((link) => link.product_id));

  return (data ?? []).map((row) => ({
    id: row.id,
    productCode: row.product_code ?? "",
    originCode: row.origin_code ?? "",
    displayName: row.name?.[locale] ?? row.name?.ru ?? "",
    make: row.make,
    model: row.model ?? "",
    alreadyInCategory: here.has(row.id),
  }));
}
