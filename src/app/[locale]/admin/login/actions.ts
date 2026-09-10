"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { looksLikeEmail } from "@/lib/phone";
import { resolveLoginEmail } from "@/lib/phoneLogin";

export type SignInState = { error: string | null };

export async function signInAction(
  prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const locale = String(formData.get("locale") ?? "");
  const invalidCredentialsMessage = String(formData.get("invalidCredentialsMessage") ?? "");

  // See resolveLoginEmail: phone logins are resolved to the account's email,
  // because Supabase's phone provider needs an SMS provider we don't have.
  const email = looksLikeEmail(identifier) ? identifier : await resolveLoginEmail(identifier);
  if (!email) {
    return { error: invalidCredentialsMessage || "Invalid login credentials" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const isInvalidCredentials = error.message.toLowerCase().includes("invalid login credentials");
    return { error: isInvalidCredentials ? invalidCredentialsMessage || error.message : error.message };
  }

  redirect(`/${locale}/admin`);
}
