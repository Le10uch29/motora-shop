"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Locale } from "@/i18n/locales";

export async function clearLogsAction(locale: Locale): Promise<{ error: string | null }> {
  await requireAdmin(locale);

  const admin = createAdminClient();
  // No single WHERE-less delete allowed by PostgREST; match everything via a
  // condition that's always true.
  const { error } = await admin.from("logs").delete().not("id", "is", null);
  if (error) return { error: error.message };

  revalidatePath(`/${locale}/admin/logs`);
  return { error: null };
}
