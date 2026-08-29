"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/logs";
import { isLocale, type Locale } from "@/i18n/locales";

export type ProductActionState = { error: string | null };

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return slug || `product-${Date.now()}`;
}

function readLocale(formData: FormData): Locale {
  const raw = String(formData.get("locale") ?? "");
  if (!isLocale(raw)) throw new Error("Missing/invalid locale in form submission");
  return raw;
}

function readLocalizedField(
  formData: FormData,
  prefix: string
): { ru: string; az: string; ka: string } | null {
  const ru = String(formData.get(`${prefix}Ru`) ?? "").trim();
  const az = String(formData.get(`${prefix}Az`) ?? "").trim();
  const ka = String(formData.get(`${prefix}Ka`) ?? "").trim();
  if (!ru && !az && !ka) return null;
  return { ru, az, ka };
}

type ParsedFields = {
  slug: string;
  category: string;
  brandId: string;
  make: string;
  model: string | null;
  yearFrom: number;
  yearTo: number;
  price: number;
  oldPrice: number | null;
  stock: number;
  originCode: string | null;
  productCode: string | null;
  name: { ru: string; az: string; ka: string };
  description: { ru: string; az: string; ka: string };
  badge: { ru: string; az: string; ka: string } | null;
  isPopular: boolean;
};

function readFields(formData: FormData): ParsedFields | null {
  const name = readLocalizedField(formData, "name");
  const description = readLocalizedField(formData, "description") ?? { ru: "", az: "", ka: "" };
  const slugInput = String(formData.get("slug") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const brandId = String(formData.get("brandId") ?? "").trim();
  const make = String(formData.get("make") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const yearFrom = Number(formData.get("yearFrom"));
  const yearTo = Number(formData.get("yearTo"));
  const price = Number(formData.get("price"));
  const oldPriceRaw = String(formData.get("oldPrice") ?? "").trim();
  const stockRaw = String(formData.get("stock") ?? "").trim();
  const originCode = String(formData.get("originCode") ?? "").trim();
  const productCode = String(formData.get("productCode") ?? "").trim();
  const badge = readLocalizedField(formData, "badge");
  const isPopular = formData.get("isPopular") === "on";

  if (
    !name ||
    !name.ru ||
    !name.az ||
    !name.ka ||
    !slugInput ||
    !category ||
    !brandId ||
    !make ||
    !Number.isFinite(yearFrom) ||
    !Number.isFinite(yearTo) ||
    !Number.isFinite(price)
  ) {
    return null;
  }

  return {
    slug: slugify(slugInput),
    category,
    brandId,
    make,
    model: model || null,
    yearFrom,
    yearTo,
    price,
    oldPrice: oldPriceRaw ? Number(oldPriceRaw) : null,
    stock: stockRaw ? Number(stockRaw) || 0 : 0,
    originCode: originCode || null,
    productCode: productCode || null,
    name,
    description,
    badge,
    isPopular,
  };
}

async function uploadImages(
  admin: ReturnType<typeof createAdminClient>,
  files: FormDataEntryValue[]
): Promise<string[]> {
  const urls: string[] = [];
  for (const file of files) {
    if (!(file instanceof File) || file.size === 0) continue;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await admin.storage.from("product-media").upload(path, file, {
      contentType: file.type || "image/jpeg",
    });
    if (error) throw new Error(error.message);
    const { data } = admin.storage.from("product-media").getPublicUrl(path);
    urls.push(data.publicUrl);
    if (urls.length >= 4) break;
  }
  return urls;
}

export async function createProductAction(
  prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const locale = readLocale(formData);
  const actor = await requireAdmin(locale);

  const fields = readFields(formData);
  if (!fields) return { error: "missing_fields" };

  const admin = createAdminClient();

  let images: string[] = [];
  try {
    images = await uploadImages(admin, formData.getAll("images"));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "upload_failed" };
  }

  const { data: created, error } = await admin
    .from("products")
    .insert({
      slug: fields.slug,
      category: fields.category,
      make: fields.make,
      model: fields.model,
      brand_id: fields.brandId,
      year_from: fields.yearFrom,
      year_to: fields.yearTo,
      price: fields.price,
      old_price: fields.oldPrice,
      stock: fields.stock,
      origin_code: fields.originCode,
      product_code: fields.productCode,
      name: fields.name,
      description: fields.description,
      specs: [],
      badge: fields.badge,
      images,
      is_popular: fields.isPopular,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  await logAction(actor, "create", "product", fields.name.ru, { entityId: created.id });
  revalidatePath(`/${locale}/admin/products`);
  revalidatePath(`/${locale}/catalog`);
  revalidatePath(`/${locale}`);
  return { error: null };
}

export async function updateProductAction(
  prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const locale = readLocale(formData);
  const actor = await requireAdmin(locale);

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "missing_fields" };

  const fields = readFields(formData);
  if (!fields) return { error: "missing_fields" };

  const admin = createAdminClient();

  const uploadedFiles = formData.getAll("images");
  const hasNewFiles = uploadedFiles.some((f) => f instanceof File && f.size > 0);
  let images: string[] | undefined;
  if (hasNewFiles) {
    try {
      images = await uploadImages(admin, uploadedFiles);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "upload_failed" };
    }
  }

  const updates: Record<string, unknown> = {
    slug: fields.slug,
    category: fields.category,
    make: fields.make,
    model: fields.model,
    brand_id: fields.brandId,
    year_from: fields.yearFrom,
    year_to: fields.yearTo,
    price: fields.price,
    old_price: fields.oldPrice,
    stock: fields.stock,
    origin_code: fields.originCode,
    product_code: fields.productCode,
    name: fields.name,
    description: fields.description,
    badge: fields.badge,
    is_popular: fields.isPopular,
  };
  if (images) updates.images = images;

  const { error } = await admin.from("products").update(updates).eq("id", id);
  if (error) return { error: error.message };

  await logAction(actor, "update", "product", fields.name.ru, { entityId: id });
  revalidatePath(`/${locale}/admin/products`);
  revalidatePath(`/${locale}/catalog`);
  revalidatePath(`/${locale}/catalog/${fields.slug}`);
  revalidatePath(`/${locale}`);
  return { error: null };
}

export type ImportRow = {
  productCode: string;
  originCode?: string;
  price?: number;
  stock?: number;
  name?: string;
  description?: string;
  make?: string;
  model?: string;
  photoUrl?: string;
  yearFrom?: number;
  yearTo?: number;
};

export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  error: string | null;
};

const IMPORT_DEFAULT_YEAR_FROM = 2000;

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

/** The same product code can appear more than once in one spreadsheet, and
 * with inconsistent casing (e.g. "21202ap" vs "21202Ap" for the same part) —
 * collapse those down to one row per code (case-insensitively) before
 * matching against the DB, taking the first non-empty value per field across
 * the repeats. Otherwise each repeat/casing variant creates its own new
 * product instead of being recognized as the same one. */
function mergeDuplicateImportRows(rows: ImportRow[]): ImportRow[] {
  const byCode = new Map<string, ImportRow>();
  for (const raw of rows) {
    const code = raw.productCode.trim();
    const key = code.toLowerCase();
    const existing = byCode.get(key);
    if (!existing) {
      byCode.set(key, { ...raw, productCode: code });
      continue;
    }
    byCode.set(key, {
      productCode: existing.productCode,
      originCode: existing.originCode ?? raw.originCode,
      price: existing.price ?? raw.price,
      stock: existing.stock ?? raw.stock,
      name: existing.name ?? raw.name,
      description: existing.description ?? raw.description,
      make: existing.make ?? raw.make,
      model: existing.model ?? raw.model,
      photoUrl: existing.photoUrl ?? raw.photoUrl,
      yearFrom: existing.yearFrom ?? raw.yearFrom,
      yearTo: existing.yearTo ?? raw.yearTo,
    });
  }
  return Array.from(byCode.values());
}

export async function importProductsAction(
  locale: Locale,
  categoryId: string,
  brandId: string,
  rows: ImportRow[]
): Promise<ImportResult> {
  const actor = await requireAdmin(locale);
  const admin = createAdminClient();
  const currentYear = new Date().getFullYear();

  const validRowsRaw = rows.filter((r) => r.productCode.trim().length > 0);
  const skipped = rows.length - validRowsRaw.length;
  if (validRowsRaw.length === 0) {
    return { created: 0, updated: 0, skipped, error: null };
  }

  const validRows = mergeDuplicateImportRows(validRowsRaw);
  const codes = validRows.map((r) => r.productCode);

  // Fetched unfiltered (not `.in("product_code", codes)`) because that
  // filter is case-sensitive — it would miss e.g. "21202Ap" already in the
  // DB when this file has "21202ap", creating a duplicate instead of
  // updating it. The table is a few hundred to low thousands of rows, so
  // fetching all of them here (once per import) is cheap.
  const [{ data: existingRows, error: fetchError }, { data: slugRows }] = await Promise.all([
    admin
      .from("products")
      .select(
        "id, product_code, price, stock, origin_code, make, model, brand_id, images, name, description, year_from, year_to"
      )
      .not("product_code", "is", null),
    admin
      .from("products")
      .select("slug")
      .in("slug", Array.from(new Set(codes.map((c) => slugify(c))))),
  ]);
  if (fetchError) return { created: 0, updated: 0, skipped: rows.length, error: fetchError.message };

  // Keyed case-insensitively — "21202ap" and "21202Ap" are the same part.
  const existingByCode = new Map<string, NonNullable<typeof existingRows>[number]>();
  for (const row of existingRows ?? []) {
    const key = row.product_code?.trim().toLowerCase();
    if (key && !existingByCode.has(key)) {
      existingByCode.set(key, row);
    }
  }

  const usedSlugs = new Set((slugRows ?? []).map((r) => r.slug));
  function uniqueSlug(base: string): string {
    let candidate = base;
    let n = 2;
    while (usedSlugs.has(candidate)) candidate = `${base}-${n++}`;
    usedSlugs.add(candidate);
    return candidate;
  }

  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; patch: Record<string, unknown> }[] = [];

  for (const row of validRows) {
    const code = row.productCode;
    const existing = existingByCode.get(code.toLowerCase());
    const nameText = row.name?.trim();
    const descriptionText = row.description?.trim();
    const originCode = row.originCode?.trim();
    const make = row.make?.trim();
    const model = row.model?.trim();
    const photoUrl = row.photoUrl?.trim();

    if (!existing) {
      toInsert.push({
        slug: uniqueSlug(slugify(code)),
        category: categoryId,
        make: make || "universal",
        model: model || null,
        brand_id: brandId,
        year_from: row.yearFrom ?? IMPORT_DEFAULT_YEAR_FROM,
        year_to: row.yearTo ?? currentYear,
        price: row.price ?? 0,
        old_price: null,
        stock: row.stock ?? 0,
        origin_code: originCode || null,
        product_code: code,
        name: nameText ? { ru: nameText, az: nameText, ka: nameText } : { ru: code, az: code, ka: code },
        description: { ru: descriptionText ?? "", az: descriptionText ?? "", ka: descriptionText ?? "" },
        specs: [],
        badge: null,
        images: photoUrl ? [photoUrl] : [],
        is_popular: false,
      });
      continue;
    }

    const patch: Record<string, unknown> = {};
    if ((existing.price === 0 || existing.price == null) && row.price) patch.price = row.price;
    if ((existing.stock === 0 || existing.stock == null) && row.stock) patch.stock = row.stock;
    if (!existing.origin_code && originCode) patch.origin_code = originCode;
    if ((!existing.make || existing.make === "universal") && make) patch.make = make;
    if (!existing.model && model) patch.model = model;
    if (!existing.brand_id && brandId) patch.brand_id = brandId;
    if ((!existing.images || existing.images.length === 0) && photoUrl) patch.images = [photoUrl];

    const nameEmpty =
      !existing.name?.ru?.trim() && !existing.name?.az?.trim() && !existing.name?.ka?.trim();
    if (nameEmpty && nameText) patch.name = { ru: nameText, az: nameText, ka: nameText };

    const descriptionEmpty =
      !existing.description?.ru?.trim() &&
      !existing.description?.az?.trim() &&
      !existing.description?.ka?.trim();
    if (descriptionEmpty && descriptionText) {
      patch.description = { ru: descriptionText, az: descriptionText, ka: descriptionText };
    }

    const isDefaultYearRange =
      existing.year_from === IMPORT_DEFAULT_YEAR_FROM && existing.year_to === currentYear;
    if (isDefaultYearRange && row.yearFrom) patch.year_from = row.yearFrom;
    if (isDefaultYearRange && row.yearTo) patch.year_to = row.yearTo;

    if (Object.keys(patch).length > 0) {
      toUpdate.push({ id: existing.id, patch });
    }
  }

  const errors: string[] = [];
  let created = 0;
  let updated = 0;

  for (const group of chunk(toInsert, 50)) {
    const { data, error } = await admin.from("products").insert(group).select("id");
    if (error) errors.push(error.message);
    else created += data?.length ?? 0;
  }

  for (const group of chunk(toUpdate, 50)) {
    const results = await Promise.all(
      group.map(({ id, patch }) => admin.from("products").update(patch).eq("id", id))
    );
    for (const { error } of results) {
      if (error) errors.push(error.message);
      else updated++;
    }
  }

  await logAction(
    actor,
    "create",
    "product",
    `Импорт Excel: ${created} новых, ${updated} обновлено, ${skipped} пропущено`,
    {}
  );
  revalidatePath(`/${locale}/admin/products`);
  revalidatePath(`/${locale}/catalog`);
  revalidatePath(`/${locale}`);

  return { created, updated, skipped, error: errors.length > 0 ? errors.join("; ") : null };
}

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
  revalidatePath(`/${locale}`);
  return { error: null };
}
