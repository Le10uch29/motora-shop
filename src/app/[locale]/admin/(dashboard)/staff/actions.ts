"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireStaffManager } from "@/lib/auth";
import { logAction } from "@/lib/logs";
import { normalizePhone, normalizePhoneForAuth } from "@/lib/phone";
import type { Locale } from "@/i18n/locales";
import { isLocale } from "@/i18n/locales";
import { assignableRoles, isStaffRole, type StaffRole } from "@/lib/roles";

export type StaffActionState = { error: string | null };

function readLocale(formData: FormData): Locale {
  const raw = String(formData.get("locale") ?? "");
  if (!isLocale(raw)) throw new Error("Missing/invalid locale in form submission");
  return raw;
}

function readStaffFields(formData: FormData) {
  const rawPhone = String(formData.get("phone") ?? "").trim();
  return {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    phone: rawPhone ? normalizePhone(rawPhone) : null,
    role: (() => {
      const raw = String(formData.get("role") ?? "seller");
      return isStaffRole(raw) ? raw : "seller";
    })(),
    warehouseId: String(formData.get("warehouseId") ?? "").trim() || null,
  };
}

function revalidateStaffPaths(locale: Locale, id?: string) {
  revalidatePath(`/${locale}/admin/staff`);
  if (id) revalidatePath(`/${locale}/admin/staff/${id}`);
}

export async function createStaffAction(
  prevState: StaffActionState,
  formData: FormData
): Promise<StaffActionState> {
  const locale = readLocale(formData);
  // Добавлять сотрудников может и старший продавец — но только продавцов.
  const actor = await requireStaffManager(locale);

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fields = readStaffFields(formData);
  if (!assignableRoles(actor.role).includes(fields.role)) return { error: "role_not_allowed" };

  if (!password || !fields.firstName || !fields.lastName || (!email && !fields.phone)) {
    return { error: "missing_fields" };
  }

  const admin = createAdminClient();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    password,
    ...(email ? { email, email_confirm: true } : {}),
    ...(fields.phone ? { phone: normalizePhoneForAuth(fields.phone), phone_confirm: true } : {}),
  });

  if (createError || !created.user) {
    return { error: createError?.message ?? "create_user_failed" };
  }

  const { error: profileError } = await admin.from("staff").insert({
    id: created.user.id,
    first_name: fields.firstName,
    last_name: fields.lastName,
    phone: fields.phone,
    role: fields.role,
    warehouse_id: fields.warehouseId,
  });

  if (profileError) {
    // Undo the auth user so we don't leave a login with no profile behind.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: profileError.message };
  }

  await logAction(actor, "create", "staff", `${fields.firstName} ${fields.lastName} (${fields.role})`, {
    entityId: created.user.id,
  });
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
  const email = String(formData.get("email") ?? "").trim();
  const fields = readStaffFields(formData);

  if (!id || !fields.firstName || !fields.lastName || (!email && !fields.phone)) {
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
      role: fields.role,
      warehouse_id: fields.warehouseId,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  const { error: contactError } = await admin.auth.admin.updateUserById(id, {
    ...(email ? { email } : {}),
    ...(fields.phone ? { phone: normalizePhoneForAuth(fields.phone) } : {}),
  });
  if (contactError) return { error: contactError.message };

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
    `${fields.firstName} ${fields.lastName} (${fields.role})${newPassword ? " + пароль" : ""}`,
    { entityId: id }
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
  // Сотрудник, назначенный из покупателей, остаётся покупателем: удаляется
  // только его роль, а учётная запись (вход, заказы) — нет.
  const { data: customer } = await admin.from("customers").select("id").eq("id", id).maybeSingle();
  if (!customer) await admin.auth.admin.deleteUser(id);

  await logAction(actor, "delete", "staff", label, { entityId: id });
  revalidateStaffPaths(locale);
  return { error: null };
}

export type ExistingUser = { id: string; name: string; phone: string; organizationName: string };

/** Покупатели, которым можно назначить роль сотрудника: по имени, телефону
 * или организации; уже работающие сотрудники не показываются. */
export async function searchUsersForStaffAction(
  locale: Locale,
  query: string
): Promise<ExistingUser[]> {
  await requireStaffManager(locale);
  const safe = query.replace(/[,()%]/g, "").trim();
  if (safe.length < 2) return [];

  const admin = createAdminClient();
  const { data } = await admin
    .from("customers")
    .select("id, first_name, last_name, phone, organization_name")
    .or(
      `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,phone.ilike.%${safe}%,organization_name.ilike.%${safe}%`
    )
    .limit(15);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: staffRows } = await admin.from("staff").select("id").in("id", rows.map((r) => r.id));
  const alreadyStaff = new Set((staffRows ?? []).map((r) => r.id));
  return rows
    .filter((r) => !alreadyStaff.has(r.id))
    .map((r) => ({
      id: r.id,
      name: `${r.first_name} ${r.last_name}`.trim(),
      phone: r.phone ?? "",
      organizationName: r.organization_name ?? "",
    }));
}

/** Назначает роль сотрудника уже существующему пользователю (покупателю).
 *
 * Новая учётная запись не создаётся: человек входит тем же логином и паролем,
 * что и раньше, и теперь видит панель. Покупателем он остаётся — его заказы
 * и корзина никуда не деваются. Старший продавец может назначить только
 * продавца. */
export async function assignStaffRoleAction(
  locale: Locale,
  userId: string,
  role: string,
  warehouseId: string | null
): Promise<{ error: string | null }> {
  const actor = await requireStaffManager(locale);
  if (!isStaffRole(role) || !assignableRoles(actor.role).includes(role as StaffRole)) {
    return { error: "role_not_allowed" };
  }

  const admin = createAdminClient();
  const [{ data: customer }, { data: existing }] = await Promise.all([
    admin.from("customers").select("first_name, last_name, phone").eq("id", userId).maybeSingle(),
    admin.from("staff").select("id").eq("id", userId).maybeSingle(),
  ]);
  if (!customer) return { error: "not_found" };
  if (existing) return { error: "already_staff" };

  const { error } = await admin.from("staff").insert({
    id: userId,
    first_name: customer.first_name,
    last_name: customer.last_name,
    phone: customer.phone,
    role,
    warehouse_id: warehouseId || null,
  });
  if (error) return { error: error.message };

  await logAction(actor, "create", "staff", `${customer.first_name} ${customer.last_name} (${role})`, {
    entityId: userId,
  });
  revalidateStaffPaths(locale);
  return { error: null };
}
