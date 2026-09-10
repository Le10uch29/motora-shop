import type { Locale } from "@/i18n/locales";
import { intlLocaleTags } from "@/i18n/locales";

function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocaleTags[locale], {
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Formats a GEL amount as the primary price, e.g. "7 900 GEL".
 * Uses the "GEL" code rather than the ₾ sign, since U+20BE has inconsistent
 * font coverage across systems and would otherwise render as a tofu glyph.
 */
export function formatGel(amountGel: number, locale: Locale): string {
  return `${formatNumber(amountGel, locale)} GEL`;
}
