const DEFAULT_COUNTRY_CODE = "+995"; // Georgia

/** True if the given login identifier looks like an email rather than a phone number. */
export function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}

/** Normalizes a phone number to E.164-ish form so "599454545" and
 * "+995599454545" are treated as the same number — strips spaces/dashes and
 * assumes the Georgian country code when none is given. Used for the app's
 * own DB columns (customers.phone, staff.phone), where the "+" is fine and
 * more readable. */
export function normalizePhone(raw: string): string {
  const digitsAndPlus = raw.trim().replace(/[^\d+]/g, "");
  if (digitsAndPlus.startsWith("+")) return digitsAndPlus;
  return `${DEFAULT_COUNTRY_CODE}${digitsAndPlus.replace(/^0+/, "")}`;
}

/** Same number, without the leading "+" — Supabase Auth's own `phone` field
 * is stored (and matched on sign-in) without it: `admin.createUser({phone:
 * "+995..."})`` actually persists it as "995...". Every call that talks to
 * Supabase Auth's phone parameter (createUser, updateUserById,
 * signInWithPassword) needs this form; passing the "+" version there
 * doesn't error, it just silently never matches, so phone login always
 * fails with a generic "invalid credentials" no matter how correct the
 * password is. */
export function normalizePhoneForAuth(raw: string): string {
  return normalizePhone(raw).replace(/^\+/, "");
}
