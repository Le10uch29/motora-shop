import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/i18n/locales";

export type StaffRole = "admin" | "seller";

export type CurrentStaff = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  idCardNumber: string | null;
  role: StaffRole;
};

/** The logged-in staff member (admin or seller), or null if not logged in / no staff profile. */
export async function getCurrentStaff(): Promise<CurrentStaff | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: staff } = await supabase
    .from("staff")
    .select("id, first_name, last_name, phone, id_card_number, role")
    .eq("id", user.id)
    .single();
  if (!staff) return null;

  return {
    id: staff.id,
    email: user.email ?? "",
    firstName: staff.first_name,
    lastName: staff.last_name,
    phone: staff.phone,
    idCardNumber: staff.id_card_number,
    role: staff.role,
  };
}

/** Redirects to the admin login if not logged in as staff at all. */
export async function requireStaff(locale: Locale): Promise<CurrentStaff> {
  const staff = await getCurrentStaff();
  if (!staff) redirect(`/${locale}/admin/login`);
  return staff;
}

/** Redirects non-admins away — sellers can't reach admin-only sections like Staff management. */
export async function requireAdmin(locale: Locale): Promise<CurrentStaff> {
  const staff = await requireStaff(locale);
  if (staff.role !== "admin") redirect(`/${locale}/admin`);
  return staff;
}

export type CurrentCustomer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  idCardNumber: string;
  organizationName: string;
  photoUrl: string | null;
};

/** The logged-in customer, or null if not logged in / no customer profile (e.g. staff). */
export async function getCurrentCustomer(): Promise<CurrentCustomer | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: customer } = await supabase
    .from("customers")
    .select("id, first_name, last_name, phone, id_card_number, organization_name, photo_url")
    .eq("id", user.id)
    .single();
  if (!customer) return null;

  return {
    id: customer.id,
    email: user.email ?? "",
    firstName: customer.first_name,
    lastName: customer.last_name,
    phone: customer.phone,
    idCardNumber: customer.id_card_number,
    organizationName: customer.organization_name,
    photoUrl: customer.photo_url,
  };
}

/** Redirects to /login if not logged in at all; staff-only accounts go to their own account page. */
export async function requireCustomer(locale: Locale): Promise<CurrentCustomer> {
  const customer = await getCurrentCustomer();
  if (customer) return customer;

  const staff = await getCurrentStaff();
  if (staff) redirect(`/${locale}/admin/account`);

  redirect(`/${locale}/login`);
}
