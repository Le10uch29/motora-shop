const NAME_LANGUAGES = ["ru", "az", "ka"] as const;
type NameLanguage = (typeof NAME_LANGUAGES)[number];
type ImportedName = Record<NameLanguage, string>;

/** Merges the names a file carries into the ones a product already has, one
 * language at a time. Returns the new name object, or null when nothing would
 * change (so the product isn't pointlessly rewritten).
 *
 * A language is filled only when it has no name of its own — matching "add the
 * name only where there isn't one, skip it where there is". What counts as
 * "no name of its own" is the subtle part, and the reason a second file used
 * to import as 0 updated / 0 added:
 *
 *  - empty, or the product code standing in for a name that was never given;
 *  - a *copy of another language*. A file with a single name column fills all
 *    three languages with the same text, so those products look named in every
 *    language while really having just one name. Treating a copy as missing is
 *    what lets a later file of Georgian (or Azerbaijani) names land in its own
 *    language instead of being skipped as "already filled".
 *
 * Languages the file doesn't cover keep displaying something: their existing
 * text, so the storefront never shows a blank name — and because that text
 * stays a copy, the next file for that language can still fill it. */
export function mergeImportedName(
  existingName: Partial<ImportedName> | null | undefined,
  fileName: Partial<Record<NameLanguage, string | undefined>>,
  productCode: string
): ImportedName | null {
  const current = {
    ru: existingName?.ru?.trim() ?? "",
    az: existingName?.az?.trim() ?? "",
    ka: existingName?.ka?.trim() ?? "",
  };

  const code = productCode.trim().toLowerCase();
  const isRealText = (value: string) => Boolean(value) && value.toLowerCase() !== code;

  function hasOwnName(lang: NameLanguage): boolean {
    const value = current[lang];
    if (!isRealText(value)) return false;
    return !NAME_LANGUAGES.some((other) => other !== lang && current[other] === value);
  }

  // What to show in a language this file says nothing about and that has no
  // name of its own: whatever the product displayed before, or — when that was
  // only the product code standing in for a name — a name from this file.
  const previousText = NAME_LANGUAGES.map((lang) => current[lang]).find(isRealText);
  const anyFileName = NAME_LANGUAGES.map((lang) => fileName[lang]?.trim() ?? "").find(Boolean);

  const merged = { ...current };
  for (const lang of NAME_LANGUAGES) {
    if (hasOwnName(lang)) continue;
    merged[lang] = fileName[lang]?.trim() || previousText || anyFileName || productCode;
  }

  const changed = NAME_LANGUAGES.some((lang) => merged[lang] !== current[lang]);
  return changed ? merged : null;
}
