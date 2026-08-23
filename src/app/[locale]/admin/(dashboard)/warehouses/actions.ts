"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/logs";
import { isLocale, type Locale } from "@/i18n/locales";

export type WarehouseActionState = { error: string | null };

function readLocale(formData: FormData): Locale {
  const raw = String(formData.get("locale") ?? "");
  if (!isLocale(raw)) throw new Error("Missing/invalid locale in form submission");
  return raw;
}

export async function createWarehouseAction(
  prevState: WarehouseActionState,
  formData: FormData
): Promise<WarehouseActionState> {
  const locale = readLocale(formData);
  const actor = await requireAdmin(locale);

  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (!name) return { error: "missing_fields" };

  const admin = createAdminClient();
  const { error } = await admin.from("warehouses").insert({ name, address: address || null });
  if (error) return { error: error.message };

  await logAction(actor, "create", "warehouse", name);
  revalidatePath(`/${locale}/admin/warehouses`);
  return { error: null };
}

export async function updateWarehouseAction(
  prevState: WarehouseActionState,
  formData: FormData
): Promise<WarehouseActionState> {
  const locale = readLocale(formData);
  const actor = await requireAdmin(locale);

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (!id || !name) return { error: "missing_fields" };

  const admin = createAdminClient();
  const { error } = await admin
    .from("warehouses")
    .update({ name, address: address || null })
    .eq("id", id);
  if (error) return { error: error.message };

  await logAction(actor, "update", "warehouse", name);
  revalidatePath(`/${locale}/admin/warehouses`);
  revalidatePath(`/${locale}/admin/warehouses/${id}`);
  return { error: null };
}

export async function deleteWarehouseAction(
  locale: Locale,
  id: string,
  label: string
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);
  const admin = createAdminClient();
  const { error } = await admin.from("warehouses").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAction(actor, "delete", "warehouse", label);
  revalidatePath(`/${locale}/admin/warehouses`);
  return { error: null };
}

export type AddStockState = { error: string | null };

/** Adds/updates one product's quantity in one warehouse (warehouse detail page). */
export async function addStockAction(
  prevState: AddStockState,
  formData: FormData
): Promise<AddStockState> {
  const locale = readLocale(formData);
  const actor = await requireAdmin(locale);

  const warehouseId = String(formData.get("warehouseId") ?? "");
  const productId = String(formData.get("productId") ?? "");
  const quantity = Number(formData.get("quantity"));
  if (!warehouseId || !productId || !Number.isFinite(quantity) || quantity < 0) {
    return { error: "missing_fields" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("warehouse_stock")
    .upsert(
      { warehouse_id: warehouseId, product_id: productId, quantity },
      { onConflict: "warehouse_id,product_id" }
    );
  if (error) return { error: error.message };

  await logAction(actor, "update", "warehouse", `stock: product ${productId} -> ${quantity}`);
  revalidatePath(`/${locale}/admin/warehouses/${warehouseId}`);
  revalidatePath(`/${locale}/admin/products`);
  return { error: null };
}

export async function removeStockAction(
  locale: Locale,
  warehouseId: string,
  productId: string
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);
  const admin = createAdminClient();
  const { error } = await admin
    .from("warehouse_stock")
    .delete()
    .eq("warehouse_id", warehouseId)
    .eq("product_id", productId);
  if (error) return { error: error.message };

  await logAction(actor, "delete", "warehouse", `stock removed: product ${productId}`);
  revalidatePath(`/${locale}/admin/warehouses/${warehouseId}`);
  revalidatePath(`/${locale}/admin/products`);
  return { error: null };
}

export type ProductStockState = { error: string | null };

/** Sets one product's quantity across multiple warehouses at once (products-list "warehouses" icon). */
export async function setProductStockAction(
  prevState: ProductStockState,
  formData: FormData
): Promise<ProductStockState> {
  const locale = readLocale(formData);
  const actor = await requireAdmin(locale);

  const productId = String(formData.get("productId") ?? "");
  if (!productId) return { error: "missing_fields" };

  const admin = createAdminClient();
  const warehouseIds = formData.getAll("warehouseId").map(String);

  for (const warehouseId of warehouseIds) {
    const quantityRaw = String(formData.get(`quantity_${warehouseId}`) ?? "").trim();
    const quantity = quantityRaw ? Number(quantityRaw) : 0;
    if (!Number.isFinite(quantity) || quantity < 0) continue;

    if (quantity === 0) {
      await admin
        .from("warehouse_stock")
        .delete()
        .eq("warehouse_id", warehouseId)
        .eq("product_id", productId);
    } else {
      await admin
        .from("warehouse_stock")
        .upsert(
          { warehouse_id: warehouseId, product_id: productId, quantity },
          { onConflict: "warehouse_id,product_id" }
        );
    }
  }

  await logAction(actor, "update", "warehouse", `stock updated for product ${productId}`);
  revalidatePath(`/${locale}/admin/products`);
  revalidatePath(`/${locale}/admin/warehouses`);
  return { error: null };
}
