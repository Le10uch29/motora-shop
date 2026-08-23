"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/logs";
import { isLocale, type Locale } from "@/i18n/locales";

export type BrandActionState = { error: string | null };

function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return slug || `brand-${Date.now()}`;
}

function readLocale(formData: FormData): Locale {
  const raw = String(formData.get("locale") ?? "");
  if (!isLocale(raw)) throw new Error("Missing/invalid locale in form submission");
  return raw;
}

async function uploadLogo(
  admin: ReturnType<typeof createAdminClient>,
  file: FormDataEntryValue | null,
  prefix: string
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  const ext = file.name.split(".").pop() || "png";
  const path = `brands/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await admin.storage.from("product-media").upload(path, file, {
    contentType: file.type || "image/png",
    upsert: true,
  });
  if (error) throw new Error(error.message);
  const { data } = admin.storage.from("product-media").getPublicUrl(path);
  return data.publicUrl;
}

export async function createBrandAction(
  prevState: BrandActionState,
  formData: FormData
): Promise<BrandActionState> {
  const locale = readLocale(formData);
  const actor = await requireAdmin(locale);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "missing_fields" };

  const admin = createAdminClient();

  let logoUrl: string | null = null;
  let badgeLogoUrl: string | null = null;
  try {
    logoUrl = await uploadLogo(admin, formData.get("logo"), "logo");
    badgeLogoUrl = await uploadLogo(admin, formData.get("badgeLogo"), "badge");
  } catch (error) {
    return { error: error instanceof Error ? error.message : "upload_failed" };
  }

  const { error } = await admin.from("brands").insert({
    slug: slugify(name),
    name,
    logo_url: logoUrl,
    badge_logo_url: badgeLogoUrl,
  });

  if (error) return { error: error.message };

  await logAction(actor, "create", "brand", name);
  revalidatePath(`/${locale}/admin/brands`);
  revalidatePath(`/${locale}/brands`);
  return { error: null };
}

export async function updateBrandAction(
  prevState: BrandActionState,
  formData: FormData
): Promise<BrandActionState> {
  const locale = readLocale(formData);
  const actor = await requireAdmin(locale);

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || !name) return { error: "missing_fields" };

  const admin = createAdminClient();

  let logoUrl: string | null = null;
  let badgeLogoUrl: string | null = null;
  try {
    logoUrl = await uploadLogo(admin, formData.get("logo"), "logo");
    badgeLogoUrl = await uploadLogo(admin, formData.get("badgeLogo"), "badge");
  } catch (error) {
    return { error: error instanceof Error ? error.message : "upload_failed" };
  }

  const updates: Record<string, unknown> = { name };
  if (logoUrl) updates.logo_url = logoUrl;
  if (badgeLogoUrl) updates.badge_logo_url = badgeLogoUrl;

  const { error } = await admin.from("brands").update(updates).eq("id", id);
  if (error) return { error: error.message };

  await logAction(actor, "update", "brand", name);
  revalidatePath(`/${locale}/admin/brands`);
  revalidatePath(`/${locale}/brands`);
  return { error: null };
}

export async function deleteBrandAction(
  locale: Locale,
  id: string,
  label: string
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);

  const admin = createAdminClient();
  const { error } = await admin.from("brands").delete().eq("id", id);
  if (error) return { error: error.message };

  await logAction(actor, "delete", "brand", label);
  revalidatePath(`/${locale}/admin/brands`);
  revalidatePath(`/${locale}/brands`);
  return { error: null };
}
