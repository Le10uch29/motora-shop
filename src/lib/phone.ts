const DEFAULT_COUNTRY_CODE = "+995"; // Georgia

/** True if the given login identifier looks like an email rather than a phone number. */
export function looksLikeEmail(value: string): boolean {
  return value.includes("@");
}

/** Normalizes a phone number to E.164-ish form so "599454545" and
 * "+995599454545" are treated as the same number — strips spaces/dashes and
 * assumes the Georgian country code when none is given. */
export function normalizePhone(raw: string): string {
  const digitsAndPlus = raw.trim().replace(/[^\d+]/g, "");
  if (digitsAndPlus.startsWith("+")) return digitsAndPlus;
  return `${DEFAULT_COUNTRY_CODE}${digitsAndPlus.replace(/^0+/, "")}`;
}
