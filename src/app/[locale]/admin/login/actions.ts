"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { looksLikeEmail, normalizePhone } from "@/lib/phone";

export type SignInState = { error: string | null };

export async function signInAction(
  prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const locale = String(formData.get("locale") ?? "");
  const invalidCredentialsMessage = String(formData.get("invalidCredentialsMessage") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(
    looksLikeEmail(identifier)
      ? { email: identifier, password }
      : { phone: normalizePhone(identifier), password }
  );

  if (error) {
    return { error: invalidCredentialsMessage || error.message };
  }

  redirect(`/${locale}/admin`);
}
