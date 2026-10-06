"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUserById } from "@/lib/supabase/authUsers";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/lib/logs";
import { generateTempPassword } from "@/lib/password";
import { normalizePhone, normalizePhoneForAuth } from "@/lib/phone";
import { isPhoneAliasEmail, phoneAliasEmail } from "@/lib/phoneLogin";
import type { Locale } from "@/i18n/locales";
import { isLocale } from "@/i18n/locales";

/** Подпись для журнала: «вместо покупателя». Запись в журнал делается один
 * раз и хранится строкой, поэтому язык берётся тот, на котором работал
 * оформивший админ — переводить задним числом уже нечего. Константа не
 * экспортируется: модуль с "use server" может отдавать наружу только
 * асинхронные функции. */
const ORDER_FOR_CUSTOMER_LABEL: Record<Locale, string> = {
  ru: "вместо покупателя",
  az: "müştəri əvəzinə",
  ka: "მყიდველის ნაცვლად",
};

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

// The form collects one "Fullname" field so a customer can be registered by
// first name alone or by first + last name — split on the first space so the
// rest (DB columns, orders, logs) keeps working with separate first/last names.
function splitFullName(raw: string): { firstName: string; lastName: string } {
  const normalized = raw.trim().replace(/\s+/g, " ");
  if (!normalized) return { firstName: "", lastName: "" };
  const [firstName, ...rest] = normalized.split(" ");
  return { firstName, lastName: rest.join(" ") };
}

function readCustomerFields(formData: FormData) {
  const rawPhone = String(formData.get("phone") ?? "").trim();
  const { firstName, lastName } = splitFullName(String(formData.get("fullName") ?? ""));
  return {
    firstName,
    lastName,
    phone: rawPhone ? normalizePhone(rawPhone) : "",
    idCardNumber: String(formData.get("idCardNumber") ?? "").trim(),
    organizationName: String(formData.get("organizationName") ?? "").trim(),
    organizationIdNumber: String(formData.get("organizationIdNumber") ?? "").trim(),
    address: String(formData.get("address") ?? "").trim(),
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

  // Last name is optional — some customers are registered as a company or by
  // first name alone. Postal code isn't collected at all any more.
  if (
    !fields.firstName ||
    !fields.phone ||
    !fields.idCardNumber ||
    !fields.organizationName ||
    !fields.organizationIdNumber ||
    !fields.address ||
    !fields.city
  ) {
    return { ...EMPTY_STATE, error: "missing_fields" };
  }

  const admin = createAdminClient();
  const password = generateTempPassword();

  // Phone is always required for customers and always usable to log in;
  // email stays optional for the admin, but the account always gets one —
  // a phone-derived stand-in when none was given — because signing in by
  // phone goes through the account's email (see resolveLoginEmail).
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    password,
    phone: normalizePhoneForAuth(fields.phone),
    phone_confirm: true,
    email: email || phoneAliasEmail(fields.phone),
    email_confirm: true,
  });

  if (createError || !created.user) {
    return { ...EMPTY_STATE, error: createError?.message ?? "create_user_failed" };
  }

  const { error: profileError } = await admin.from("customers").insert({
    id: created.user.id,
    first_name: fields.firstName,
    last_name: fields.lastName,
    phone: fields.phone,
    id_card_number: fields.idCardNumber,
    organization_name: fields.organizationName,
    organization_id_number: fields.organizationIdNumber,
    address: fields.address,
    city: fields.city,
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
    !fields.phone ||
    !fields.idCardNumber ||
    !fields.organizationName ||
    !fields.organizationIdNumber ||
    !fields.address ||
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
    .select(
      "first_name, last_name, phone, id_card_number, organization_name, organization_id_number, address, city"
    )
    .eq("id", id)
    .single();

  if (!before) return { ...EMPTY_STATE, error: "not_found" };

  const { error } = await admin
    .from("customers")
    .update({
      first_name: fields.firstName,
      last_name: fields.lastName,
      phone: fields.phone,
      id_card_number: fields.idCardNumber,
      organization_name: fields.organizationName,
      organization_id_number: fields.organizationIdNumber,
      address: fields.address,
      city: fields.city,
    })
    .eq("id", id);

  if (error) return { ...EMPTY_STATE, error: error.message };

  // Phone doubles as the login identifier — keep auth.users in sync so a
  // changed contact number doesn't lock the customer out. A stand-in address
  // derived from the old number moves with it, so it stays in step with the
  // phone (and can't collide with a new customer given that old number).
  if (fields.phone !== before.phone) {
    const authUser = await getAuthUserById(admin, id);
    const { error: phoneError } = await admin.auth.admin.updateUserById(id, {
      phone: normalizePhoneForAuth(fields.phone),
      ...(isPhoneAliasEmail(authUser?.email)
        ? { email: phoneAliasEmail(fields.phone), email_confirm: true }
        : {}),
    });
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
      organizationIdNumber: before.organization_id_number,
      address: before.address,
      city: before.city,
    },
    fields
  );
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

/** Товары, которые админ собрал в корзину вместо покупателя. */
export type OrderForCustomerItem = { productId: string; quantity: number };

/**
 * Оформляет заказ от имени покупателя.
 *
 * Зачем: это склад, и часть покупателей на сайт не заходит вовсе — заказ
 * принимают по телефону. Чтобы такие заказы не жили в тетрадке, админ
 * оформляет их здесь, и дальше они идут обычным путём: в списке заказов,
 * в статистике и в карточке покупателя они выглядят как его собственные.
 *
 * Строки вставляются одним INSERT — триггер orders_set_order_number выдаёт
 * всем строкам одного оформления общий номер, а orders_set_price_from_product
 * сам проставляет цену и название на момент заказа. Поэтому отсюда уходят
 * только customer_id, product_id и количество: цену подделать нельзя даже
 * отсюда.
 *
 * След в журнале обязателен: в заказе будет стоять покупатель, и без записи
 * о том, кто его оформил, подменить заказ было бы невозможно отследить.
 */
export async function placeOrderForCustomerAction(
  locale: Locale,
  customerId: string,
  items: OrderForCustomerItem[]
): Promise<{ error: string | null; orderNumber: number | null }> {
  const actor = await requireAdmin(locale);
  if (items.length === 0) return { error: "empty_cart", orderNumber: null };

  const admin = createAdminClient();

  const { data: customer } = await admin
    .from("customers")
    .select("id, first_name, last_name, phone")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return { error: "customer_not_found", orderNumber: null };

  // Товар, который закончился, пока админ собирал корзину, в заказ не идёт —
  // то же правило, что и в корзине покупателя.
  const { data: products } = await admin
    .from("products")
    .select("id")
    .in("id", items.map((item) => item.productId))
    .gt("stock", 0);
  const orderable = new Set((products ?? []).map((product) => product.id));

  const rows = items
    .filter((item) => orderable.has(item.productId))
    .map((item, index) => ({
      customer_id: customerId,
      product_id: item.productId,
      quantity: Math.max(1, Math.floor(item.quantity)),
      // Порядок, в котором админ набирал корзину, — он же порядок позиций
      // в заказе.
      line_number: index + 1,
    }));
  if (rows.length === 0) return { error: "products_not_found", orderNumber: null };

  let { data: inserted, error } = await admin.from("orders").insert(rows).select("order_number");
  if (error && error.message.includes("line_number")) {
    // Схему обновляют вручную, столбца может ещё не быть — заказ важнее
    // порядка строк.
    ({ data: inserted, error } = await admin
      .from("orders")
      .insert(
        rows.map((row) => ({
          customer_id: row.customer_id,
          product_id: row.product_id,
          quantity: row.quantity,
        }))
      )
      .select("order_number"));
  }
  if (error) return { error: error.message, orderNumber: null };

  const orderNumber = inserted?.[0]?.order_number ?? null;
  const customerName = `${customer.first_name} ${customer.last_name}`.trim();

  await logAction(
    actor,
    "create",
    "order",
    `№${orderNumber} ${ORDER_FOR_CUSTOMER_LABEL[locale]} ${customerName}`,
    {
      details: {
        placedByEmail: actor.email,
        customerPhone: customer.phone ?? "",
      },
    }
  );

  revalidatePath(`/${locale}/admin/orders`);
  revalidatePath(`/${locale}/admin/orders/${customerId}`);
  revalidatePath(`/${locale}/admin/customers/${customerId}`);
  revalidatePath(`/${locale}/admin`);
  return { error: null, orderNumber };
}
