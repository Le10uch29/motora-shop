export const locales = ["ka", "ru", "az"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ka";

export const intlLocaleTags: Record<Locale, string> = {
  ru: "ru-RU",
  az: "az-Latn-AZ",
  ka: "ka-GE",
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
