"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/logs";
import { PRODUCTS_CACHE_TAG } from "@/lib/productFilterMeta";
import { fitmentColumns } from "@/lib/fitments";
import { syncPopularFromProductFlag } from "@/lib/promotions";
import {
  DEFAULT_CATEGORY,
  MAX_IMAGES,
  readFields,
  readImageUrls,
  readLocale,
  setPrimaryCategory,
  uploadImages,
} from "./productForm";
import type { ProductActionState } from "./productTypes";

export async function createProductAction(
  prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const locale = readLocale(formData);
  // Добавлять товар может любой сотрудник, в том числе продавец.
  const actor = await requireStaff(locale);
  const isAdmin = actor.role === "admin";

  const fields = readFields(formData);
  if (!fields) return { error: "missing_fields" };

  const admin = createAdminClient();

  let images: string[] = [];
  try {
    images = [...(await uploadImages(admin, formData.getAll("images"))), ...readImageUrls(formData)]
      .slice(0, MAX_IMAGES);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "upload_failed" };
  }

  const { data: created, error } = await admin
    .from("products")
    .insert({
      slug: fields.slug,
      category: DEFAULT_CATEGORY,
      ...fitmentColumns(fields.fitments),
      brand_id: fields.brandId,
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
      // «Популярное» — подборка из «Акций», её ведёт только админ.
      is_popular: isAdmin && fields.isPopular,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const categoryError = await setPrimaryCategory(
    admin,
    created.id,
    String(formData.get("categoryId") ?? "").trim()
  );
  if (categoryError) return { error: categoryError };

  if (isAdmin) await syncPopularFromProductFlag(created.id, fields.isPopular);
  await logAction(actor, "create", "product", fields.name.ru, { entityId: created.id });
  revalidatePath(`/${locale}/admin/products`);
  revalidatePath(`/${locale}/catalog`);
  updateTag(PRODUCTS_CACHE_TAG);
  revalidatePath(`/${locale}`);
  return { error: null };
}

export async function updateProductAction(
  prevState: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const locale = readLocale(formData);
  // Редактировать товар может любой сотрудник, в том числе продавец.
  const actor = await requireStaff(locale);
  const isAdmin = actor.role === "admin";

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "missing_fields" };

  const fields = readFields(formData);
  if (!fields) return { error: "missing_fields" };

  const admin = createAdminClient();

  const uploadedFiles = formData.getAll("images");
  const hasNewFiles = uploadedFiles.some((f) => f instanceof File && f.size > 0);
  const imageUrls = readImageUrls(formData);
  // Photos are only touched when the form actually carries new ones (files,
  // links, or both) — leaving both empty keeps whatever the product has.
  let images: string[] | undefined;
  if (hasNewFiles || imageUrls.length > 0) {
    try {
      images = [
        ...(hasNewFiles ? await uploadImages(admin, uploadedFiles) : []),
        ...imageUrls,
      ].slice(0, MAX_IMAGES);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "upload_failed" };
    }
  }

  const updates: Record<string, unknown> = {
    slug: fields.slug,
    ...fitmentColumns(fields.fitments),
    brand_id: fields.brandId,
    price: fields.price,
    old_price: fields.oldPrice,
    stock: fields.stock,
    origin_code: fields.originCode,
    product_code: fields.productCode,
    name: fields.name,
    description: fields.description,
    badge: fields.badge,
    // Не админ галочку «популярный» не видит — у него она не меняется.
    ...(isAdmin ? { is_popular: fields.isPopular } : {}),
  };
  if (images) updates.images = images;

  const { error } = await admin.from("products").update(updates).eq("id", id);
  if (error) return { error: error.message };

  const categoryError = await setPrimaryCategory(
    admin,
    id,
    String(formData.get("categoryId") ?? "").trim()
  );
  if (categoryError) return { error: categoryError };

  if (isAdmin) await syncPopularFromProductFlag(id, fields.isPopular);
  await logAction(actor, "update", "product", fields.name.ru, { entityId: id });
  revalidatePath(`/${locale}/admin/products`);
  revalidatePath(`/${locale}/catalog`);
  updateTag(PRODUCTS_CACHE_TAG);
  revalidatePath(`/${locale}/catalog/${fields.slug}`);
  revalidatePath(`/${locale}`);
  return { error: null };
}
