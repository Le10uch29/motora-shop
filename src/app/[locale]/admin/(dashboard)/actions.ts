"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOutAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/admin/login`);
}
