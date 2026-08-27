"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/lib/logs";
import { generateTempPassword } from "@/lib/password";
import { normalizePhone } from "@/lib/phone";
import type { Locale } from "@/i18n/locales";
import { isLocale } from "@/i18n/locales";

export type DeliveryMethod = "email" | "phone" | "screen";

export type CustomerActionState = {
  error: string | null;
  createdPassword: string | null;
  deliveryMethod: DeliveryMethod | null;
};

const EMPTY_STATE: CustomerActionState = {
  error: null,
  createdPassword: null,
  deliveryMethod: null,
};

function readLocale(formData: FormData): Locale {
  const raw = String(formData.get("locale") ?? "");
  if (!isLocale(raw)) throw new Error("Missing/invalid locale in form submission");
  return raw;
}

function readCustomerFields(formData: FormData) {
  const rawPhone = String(formData.get("phone") ?? "").trim();
  return {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    phone: rawPhone ? normalizePhone(rawPhone) : "",
    idCardNumber: String(formData.get("idCardNumber") ?? "").trim(),
    organizationName: String(formData.get("organizationName") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
    postalCode: String(formData.get("postalCode") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
  };
}

function readDeliveryMethod(formData: FormData): DeliveryMethod {
  const raw = String(formData.get("deliveryMethod") ?? "screen");
  if (raw === "email" || raw === "phone") return raw;
  return "screen";
}

function revalidateCustomerPaths(locale: Locale, id?: string) {
  revalidatePath(`/${locale}/admin/customers`);
  if (id) revalidatePath(`/${locale}/admin/customers/${id}`);
}

async function uploadPhoto(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  file: FormDataEntryValue | null
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/photo-${Date.now()}.${ext}`;
  const { error } = await admin.storage.from("customer-media").upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: true,
  });
  if (error) throw new Error(error.message);
  const { data } = admin.storage.from("customer-media").getPublicUrl(path);
  return data.publicUrl;
}

type FieldDiff = { before: string; after: string };

function diffTextFields(
  before: Record<string, string>,
  after: Record<string, string>
): Record<string, FieldDiff> {
  const details: Record<string, FieldDiff> = {};
  for (const key of Object.keys(after)) {
    if (before[key] !== after[key]) {
      details[key] = { before: before[key] ?? "", after: after[key] ?? "" };
    }
  }
  return details;
}

export async function createCustomerAction(
  prevState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const locale = readLocale(formData);
  const actor = await requireAdmin(locale);

  const email = String(formData.get("email") ?? "").trim();
  const fields = readCustomerFields(formData);
  const deliveryMethod = readDeliveryMethod(formData);

  if (
    !fields.firstName ||
    !fields.lastName ||
    !fields.phone ||
    !fields.idCardNumber ||
    !fields.organizationName ||
    !fields.address ||
    !fields.postalCode ||
    !fields.city
  ) {
    return { ...EMPTY_STATE, error: "missing_fields" };
  }

  const admin = createAdminClient();
  const password = generateTempPassword();

  // Phone is always required for customers and always usable to log in;
  // email stays optional (given only if the admin filled it in).
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    password,
    phone: fields.phone,
    phone_confirm: true,
    ...(email ? { email, email_confirm: true } : {}),
  });

  if (createError || !created.user) {
    return { ...EMPTY_STATE, error: createError?.message ?? "create_user_failed" };
  }

  let photoUrl: string | null = null;
  try {
    photoUrl = await uploadPhoto(admin, created.user.id, formData.get("photo"));
  } catch (error) {
    // Undo the auth user so we don't leave a login with no profile behind.
    await admin.auth.admin.deleteUser(created.user.id);
    return { ...EMPTY_STATE, error: error instanceof Error ? error.message : "upload_failed" };
  }

  const { error: profileError } = await admin.from("customers").insert({
    id: created.user.id,
    first_name: fields.firstName,
    last_name: fields.lastName,
    phone: fields.phone,
    id_card_number: fields.idCardNumber,
    organization_name: fields.organizationName,
    address: fields.address,
    postal_code: fields.postalCode,
    city: fields.city,
    photo_url: photoUrl,
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { ...EMPTY_STATE, error: profileError.message };
  }

  await logAction(actor, "create", "customer", `${fields.firstName} ${fields.lastName}`, {
    entityId: created.user.id,
    details: { deliveryMethod },
  });
  revalidateCustomerPaths(locale);
  return { error: null, createdPassword: password, deliveryMethod };
}

export async function updateCustomerAction(
  prevState: CustomerActionState,
  formData: FormData
): Promise<CustomerActionState> {
  const locale = readLocale(formData);
  const actor = await requireAdmin(locale);

  const id = String(formData.get("id") ?? "");
  const newPassword = String(formData.get("password") ?? "");
  const fields = readCustomerFields(formData);

  if (
    !id ||
    !fields.firstName ||
    !fields.lastName ||
    !fields.phone ||
    !fields.idCardNumber ||
    !fields.organizationName ||
    !fields.address ||
    !fields.postalCode ||
    !fields.city
  ) {
    return { ...EMPTY_STATE, error: "missing_fields" };
  }
  if (newPassword && newPassword.length < 6) {
    return { ...EMPTY_STATE, error: "password_too_short" };
  }

  const admin = createAdminClient();

  const { data: before } = await admin
    .from("customers")
    .select("first_name, last_name, phone, id_card_number, organization_name, address, postal_code, city, photo_url")
    .eq("id", id)
    .single();

  if (!before) return { ...EMPTY_STATE, error: "not_found" };

  let photoUrl = before.photo_url;
  try {
    const uploaded = await uploadPhoto(admin, id, formData.get("photo"));
    if (uploaded) photoUrl = uploaded;
  } catch (error) {
    return { ...EMPTY_STATE, error: error instanceof Error ? error.message : "upload_failed" };
  }

  const { error } = await admin
    .from("customers")
    .update({
      first_name: fields.firstName,
      last_name: fields.lastName,
      phone: fields.phone,
      id_card_number: fields.idCardNumber,
      organization_name: fields.organizationName,
      address: fields.address,
      postal_code: fields.postalCode,
      city: fields.city,
      photo_url: photoUrl,
    })
    .eq("id", id);

  if (error) return { ...EMPTY_STATE, error: error.message };

  // Phone doubles as the login identifier — keep auth.users in sync so a
  // changed contact number doesn't lock the customer out.
  if (fields.phone !== before.phone) {
    const { error: phoneError } = await admin.auth.admin.updateUserById(id, { phone: fields.phone });
    if (phoneError) return { ...EMPTY_STATE, error: phoneError.message };
  }

  if (newPassword) {
    const { error: passwordError } = await admin.auth.admin.updateUserById(id, {
      password: newPassword,
    });
    if (passwordError) return { ...EMPTY_STATE, error: passwordError.message };
  }

  const details: Record<string, FieldDiff | true> = diffTextFields(
    {
      firstName: before.first_name,
      lastName: before.last_name,
      phone: before.phone,
      idCardNumber: before.id_card_number,
      organizationName: before.organization_name,
      address: before.address,
      postalCode: before.postal_code,
      city: before.city,
    },
    fields
  );
  if (photoUrl !== before.photo_url) details.photoUrl = true;
  if (newPassword) details.password = true;

  await logAction(actor, "update", "customer", `${fields.firstName} ${fields.lastName}`, {
    entityId: id,
    details,
  });
  revalidateCustomerPaths(locale, id);
  return { ...EMPTY_STATE, error: null };
}

export async function deleteCustomerAction(
  locale: Locale,
  id: string,
  label: string
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);

  const admin = createAdminClient();
  await admin.from("customers").delete().eq("id", id);
  await admin.auth.admin.deleteUser(id);

  try {
    const { data: files } = await admin.storage.from("customer-media").list(id);
    if (files && files.length > 0) {
      await admin.storage.from("customer-media").remove(files.map((f) => `${id}/${f.name}`));
    }
  } catch {
    // Best-effort cleanup — a stray file in storage isn't worth failing the delete over.
  }

  await logAction(actor, "delete", "customer", label, { entityId: id });
  revalidateCustomerPaths(locale);
  return { error: null };
}
