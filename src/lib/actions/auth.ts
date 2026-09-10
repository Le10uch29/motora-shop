"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { looksLikeEmail } from "@/lib/phone";
import { resolveLoginEmail } from "@/lib/phoneLogin";

/** Signs out from anywhere on the public site (header icon, mobile menu). */
export async function signOutAction(formData: FormData) {
  const locale = String(formData.get("locale") ?? "");
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}`);
}

export type SignInState = { error: string | null };

/** Signs in on the public site — staff and admin-provisioned customers alike.
 * Accepts either an email or a phone number as the identifier (customers are
 * always given a phone; email is optional for them). */
export async function signInAction(
  prevState: SignInState,
  formData: FormData
): Promise<SignInState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const locale = String(formData.get("locale") ?? "");
  const invalidCredentialsMessage = String(formData.get("invalidCredentialsMessage") ?? "");

  // A phone number is turned into the account's email first — Supabase's own
  // phone login needs an SMS provider this project doesn't have.
  const email = looksLikeEmail(identifier) ? identifier : await resolveLoginEmail(identifier);
  if (!email) {
    return { error: invalidCredentialsMessage || "Invalid login credentials" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Only mask genuine wrong-login/wrong-password cases behind the
    // friendly translated message (so a login attempt can't be used to
    // probe which accounts exist) — a real config problem (e.g. a disabled
    // auth provider) shows its actual message instead of also looking like
    // "wrong password", which is undiagnosable from the outside.
    const isInvalidCredentials = error.message.toLowerCase().includes("invalid login credentials");
    return { error: isInvalidCredentials ? invalidCredentialsMessage || error.message : error.message };
  }

  redirect(`/${locale}`);
}
