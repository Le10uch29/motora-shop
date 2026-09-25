/** Cyrillic letters as their usual latin stand-ins, so a category named
 * "Ходовая часть" becomes "hodovaya-chast" rather than an empty string. */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

/**
 * A URL-safe slug: lowercase latin, digits and single dashes.
 *
 * Cyrillic is transliterated; anything else that isn't latin or a digit
 * (Azerbaijani and Georgian letters, punctuation) is dropped, so a name
 * written only in those alphabets needs a slug typed by hand — the caller
 * gets an empty string back and can say so.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[а-яё]/g, (letter) => CYRILLIC_TO_LATIN[letter] ?? "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Makes `base` unique against slugs already taken, by adding -2, -3, … */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!used.has(candidate)) return candidate;
  }
}
