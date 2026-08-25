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
  const description = readLocalizedField(formData, "description");
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
    !description ||
    !description.ru ||
    !description.az ||
    !description.ka ||
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
