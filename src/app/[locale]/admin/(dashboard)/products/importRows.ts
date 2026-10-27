import { mergeOem, primaryOem } from "@/lib/oem";

/**
 * Строки Excel-импорта товаров и склейка повторов одного кода.
 *
 * Отдельным модулем, а не в actions.ts: файл с "use server" может
 * экспортировать только async-функции, а это обычная чистая функция, которую
 * нужно тестировать напрямую.
 */

export type ImportRow = {
  productCode: string;
  originCode?: string;
  price?: number;
  stock?: number;
  /** Product name per language — each mapped from its own column, so a file
   * can carry any one, two, or all three of them. A missing language falls
   * back to whichever one the file does have. */
  nameRu?: string;
  nameAz?: string;
  nameKa?: string;
  description?: string;
  /** Make, model and years as written in their cells. A part that fits several
   * vehicles writes them with slashes — "TOYOTA/BMW" with "PRIUS V/PRIUS
   * C//G30/X5" — where "//" closes one make's group of models, and "///" ends
   * the vehicles and starts the description ("ASTRA H///1,6"); see
   * {@link fitmentsFromImport} for the whole notation. */
  make?: string;
  model?: string;
  photoUrl?: string;
  /** Years in one column of their own: "2000:2002", or a range per make group
   * as "2000:2002//2010:2015". */
  years?: string;
  /** Years split across two columns instead — the older file layout. */
  yearFrom?: string;
  yearTo?: string;
  /** Warehouse name as written in the file's own warehouse column, if one
   * was mapped — matched case-insensitively against real warehouse names.
   * Falls back to the whole-file warehouse selection when absent or when it
   * doesn't match a real warehouse. */
  warehouseName?: string;
};

export type ImportRowConflict = {
  productCode: string;
  originCode?: string;
  field: string;
  values: string[];
  resolvedValue: string;
};

/** The same product code can appear more than once in one spreadsheet, and
 * with inconsistent casing (e.g. "21202ap" vs "21202Ap" for the same part) —
 * collapse those down to one row per code (case-insensitively) before
 * matching against the DB, taking the first non-empty value per field across
 * the repeats. Otherwise each repeat/casing variant creates its own new
 * product instead of being recognized as the same one.
 *
 * If repeats of the same code disagree on price, that's a real conflict
 * (not just one row having the field and another not) — the higher price is
 * kept automatically and the disagreement is returned so it can be logged
 * for an admin to double-check later, rather than silently picking one. */
export function mergeDuplicateImportRows(rows: ImportRow[]): {
  rows: ImportRow[];
  conflicts: ImportRowConflict[];
} {
  const byCode = new Map<string, ImportRow>();
  const conflicts: ImportRowConflict[] = [];

  for (const raw of rows) {
    const code = raw.productCode.trim();
    const key = code.toLowerCase();
    const existing = byCode.get(key);
    if (!existing) {
      byCode.set(key, { ...raw, productCode: code });
      continue;
    }

    let price = existing.price;
    if (raw.price != null) {
      if (existing.price == null) {
        price = raw.price;
      } else if (raw.price !== existing.price) {
        price = Math.max(existing.price, raw.price);
        conflicts.push({
          productCode: code,
          originCode: primaryOem(existing.originCode ?? raw.originCode),
          field: "price",
          values: [String(existing.price), String(raw.price)],
          resolvedValue: String(price),
        });
      }
    }

    byCode.set(key, {
      productCode: existing.productCode,
      // Повторы одного кода могут нести разные OEM — сохраняем все.
      originCode: mergeOem(existing.originCode, raw.originCode) ?? undefined,
      price,
      stock: existing.stock ?? raw.stock,
      nameRu: existing.nameRu ?? raw.nameRu,
      nameAz: existing.nameAz ?? raw.nameAz,
      nameKa: existing.nameKa ?? raw.nameKa,
      description: existing.description ?? raw.description,
      make: existing.make ?? raw.make,
      model: existing.model ?? raw.model,
      photoUrl: existing.photoUrl ?? raw.photoUrl,
      years: existing.years ?? raw.years,
      yearFrom: existing.yearFrom ?? raw.yearFrom,
      yearTo: existing.yearTo ?? raw.yearTo,
      warehouseName: existing.warehouseName ?? raw.warehouseName,
    });
  }

  return { rows: Array.from(byCode.values()), conflicts };
}
