import "server-only";
import type { Locale } from "@/i18n/locales";
import type { Dictionary } from "@/i18n/dictionary";

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  ru: () => import("@/i18n/dictionaries/ru").then((m) => m.default),
  az: () => import("@/i18n/dictionaries/az").then((m) => m.default),
  ka: () => import("@/i18n/dictionaries/ka").then((m) => m.default),
};

export function getDictionary(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
