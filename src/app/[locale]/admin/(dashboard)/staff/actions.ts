"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/lib/logs";
import type { Locale } from "@/i18n/locales";
import { isLocale } from "@/i18n/locales";

export type StaffActionState = { error: string | null };

function readLocale(formData: FormData): Locale {
  const raw = String(formData.get("locale") ?? "");
  if (!isLocale(raw)) throw new Error("Missing/invalid locale in form submission");
  return raw;
}

function readStaffFields(formData: FormData) {
  return {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim() || null,
    idCardNumber: String(formData.get("idCardNumber") ?? "").trim() || null,
    role: String(formData.get("role") ?? "seller") === "admin" ? "admin" : "seller",
  };
}

function revalidateStaffPaths(locale: Locale, id?: string) {
  revalidatePath(`/${locale}/admin/staff/admins`);
  revalidatePath(`/${locale}/admin/staff/sellers`);
  if (id) revalidatePath(`/${locale}/admin/staff/${id}`);
}

export async function createStaffAction(
  prevState: StaffActionState,
  formData: FormData
): Promise<StaffActionState> {
  const locale = readLocale(formData);
  const actor = await requireAdmin(locale);

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fields = readStaffFields(formData);

  if (!email || !password || !fields.firstName || !fields.lastName) {
    return { error: "missing_fields" };
  }

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return { error: createError?.message ?? "create_user_failed" };
  }

  const { error: profileError } = await admin.from("staff").insert({
    id: created.user.id,
    first_name: fields.firstName,
    last_name: fields.lastName,
    phone: fields.phone,
    id_card_number: fields.idCardNumber,
    role: fields.role,
  });

  if (profileError) {
    // Undo the auth user so we don't leave a login with no profile behind.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: profileError.message };
  }

  await logAction(actor, "create", "staff", `${fields.firstName} ${fields.lastName} (${fields.role})`);
  revalidateStaffPaths(locale);
  return { error: null };
}

export async function updateStaffAction(
  prevState: StaffActionState,
  formData: FormData
): Promise<StaffActionState> {
  const locale = readLocale(formData);
  const actor = await requireAdmin(locale);

  const id = String(formData.get("id") ?? "");
  const newPassword = String(formData.get("password") ?? "");
  const fields = readStaffFields(formData);

  if (!id || !fields.firstName || !fields.lastName) {
    return { error: "missing_fields" };
  }
  if (newPassword && newPassword.length < 6) {
    return { error: "password_too_short" };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("staff")
    .update({
      first_name: fields.firstName,
      last_name: fields.lastName,
      phone: fields.phone,
      id_card_number: fields.idCardNumber,
      role: fields.role,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  if (newPassword) {
    const { error: passwordError } = await admin.auth.admin.updateUserById(id, {
      password: newPassword,
    });
    if (passwordError) return { error: passwordError.message };
  }

  await logAction(
    actor,
    "update",
    "staff",
    `${fields.firstName} ${fields.lastName} (${fields.role})${newPassword ? " + пароль" : ""}`
  );
  revalidateStaffPaths(locale, id);
  return { error: null };
}

export async function deleteStaffAction(
  locale: Locale,
  id: string,
  label: string
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);
  if (actor.id === id) {
    return { error: "cannot_fire_self" };
  }

  const admin = createAdminClient();
  await admin.from("staff").delete().eq("id", id);
  await admin.auth.admin.deleteUser(id);

  await logAction(actor, "delete", "staff", label);
  revalidateStaffPaths(locale);
  return { error: null };
}
