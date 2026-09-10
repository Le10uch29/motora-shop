import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone, normalizePhoneForAuth } from "@/lib/phone";

/** Domain for the stand-in address given to an account whose owner has no
 * email of their own. It never receives mail — the account is created with
 * `email_confirm: true`, so nothing is ever sent to it. It exists purely so
 * that every account has an email to sign in with; see
 * {@link resolveLoginEmail} for why phone numbers can't be used directly. */
const PHONE_ALIAS_DOMAIN = "phone.local";

/** The stand-in login address for a phone number, e.g. "995599123456@phone.local". */
export function phoneAliasEmail(rawPhone: string): string {
  return `${normalizePhoneForAuth(rawPhone)}@${PHONE_ALIAS_DOMAIN}`;
}

/** True for an address this app generated from a phone number rather than one
 * the person actually gave — those are an implementation detail and are shown
 * as "no email" in the admin UI. */
export function isPhoneAliasEmail(email: string | null | undefined): boolean {
  return Boolean(email?.endsWith(`@${PHONE_ALIAS_DOMAIN}`));
}

/** Turns whatever was typed into the login box into the email to sign in with.
 *
 * Supabase's own phone login (`signInWithPassword({ phone })`) needs the Phone
 * auth provider enabled, and enabling that requires a paid SMS provider —
 * without one it answers `phone_provider_disabled` (422) no matter how correct
 * the password is, which is exactly why logging in by phone never worked.
 * Since every account here already has an email (a real one, or the phone
 * alias above), a phone is resolved to its account's email and signed in that
 * way, with no SMS provider involved.
 *
 * Returns null when no account matches — the caller then reports the same
 * generic "wrong login or password" as any other failure, so this can't be
 * used to probe which numbers are registered. */
export async function resolveLoginEmail(identifier: string): Promise<string | null> {
  const phone = normalizePhone(identifier);
  const admin = createAdminClient();

  // Both profile tables store the normalized "+995…" form; a person is in one
  // of them (customer) or the other (staff), never both.
  const [{ data: customer }, { data: staff }] = await Promise.all([
    admin.from("customers").select("id").eq("phone", phone).maybeSingle(),
    admin.from("staff").select("id").eq("phone", phone).maybeSingle(),
  ]);

  const userId = customer?.id ?? staff?.id;
  if (!userId) return null;

  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}
