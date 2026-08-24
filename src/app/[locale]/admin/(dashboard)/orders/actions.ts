"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { logAction } from "@/lib/logs";
import type { Locale } from "@/i18n/locales";

export async function cancelOrderAction(
  locale: Locale,
  id: string,
  customerId: string,
  label: string
): Promise<{ error: string | null }> {
  const actor = await requireAdmin(locale);

  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "new");

  if (error) return { error: error.message };

  await logAction(actor, "delete", "order", label, { entityId: id });
  revalidatePath(`/${locale}/admin/orders`);
  revalidatePath(`/${locale}/admin/orders/${customerId}`);
  revalidatePath(`/${locale}/admin/orders/${customerId}/${id}`);
  return { error: null };
}
