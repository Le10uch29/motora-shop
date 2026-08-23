"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Signs out from anywhere on the public site (header icon, mobile menu). */
export async function signOutAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}`);
}
