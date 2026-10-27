import type { createAdminClient } from "@/lib/supabase/admin";
import {
  UNIVERSAL_MAKE,
  fitmentColumns,
  fitmentsFromImport,
  splitModelAndDescription,
  fitmentsOf,
  fitmentsToFields,
  OPEN_YEAR_FROM,
  OPEN_YEAR_TO,
  type Fitment,
} from "@/lib/fitments";
import { mergeOem, normalizeOem } from "@/lib/oem";
import { mergeImportedName } from "./importName";
import { DEFAULT_CATEGORY, slugify } from "./productForm";
import type { ImportRow, ImportRowConflict } from "./importRows";

/*
 * Шаги Excel-импорта товаров. importProductsAction (importActions.ts) только
 * вызывает их по порядку:
 *
 *   1. loadImportContext — что уже есть в базе: товары бренда, занятые
 *      slug'и, склады;
 *   2. planImportRows    — по каждой строке файла решить: новый товар,
 *      дополнение существующего или «без изменений»;
 *   3. writeImportedProducts — вставка и обновление пачками по 50;
 *   4. applyWarehouseStock   — остатки на складах для получившихся товаров;
 *   5. logImportConflicts    — расхождения цен у повторов одного кода.
 *
 * Код шагов перенесён из прежнего единого importProductsAction без изменений.
 */

type AdminClient = ReturnType<typeof createAdminClient>;

/** Так раньше записывался товар, у которого в файле не было года: с 2000 по
 * год импорта. Теперь год просто остаётся пустым, но такие старые товары
 * по-прежнему считаются «без года» — файл может их дополнить. */
const LEGACY_DEFAULT_YEAR_FROM = 2000;

export function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

type LocalizedName = Partial<Record<"ru" | "az" | "ka", string>>;

/** Товар из базы в том виде, в каком его читает импорт. */
export type ExistingProductRow = {
  id: string;
  product_code: string | null;
  price: number | null;
  stock: number | null;
  origin_code: string | null;
  make: string;
  model: string | null;
  fitments: Fitment[] | null;
  brand_id: string | null;
  images: string[] | null;
  name: LocalizedName | null;
  description: LocalizedName | null;
  year_from: number;
  year_to: number;
};

export type ImportContext = {
  existingByCode: Map<string, ExistingProductRow>;
  uniqueSlug: (base: string) => string;
  resolveWarehouseId: (warehouseName: string | undefined) => string | null;
};

/** Шаг 1: всё, что импорту нужно знать о базе, — одним заходом. */
export async function loadImportContext(
  admin: AdminClient,
  brandId: string,
  codes: string[],
  fallbackWarehouseId: string | undefined
): Promise<{ context: ImportContext; error: null } | { context: null; error: string }> {
  // Fetched unfiltered (not `.in("product_code", codes)`) because that
  // filter is case-sensitive — it would miss e.g. "21202Ap" already in the
  // DB when this file has "21202ap", creating a duplicate instead of
  // updating it. The table is a few hundred to low thousands of rows, so
  // fetching all of them here (once per import) is cheap.
  const [{ data: existingRows, error: fetchError }, { data: slugRows }, { data: warehouseRows }] =
    await Promise.all([
      admin
        .from("products")
        .select(
          "id, product_code, price, stock, origin_code, make, model, fitments, brand_id, images, name, description, year_from, year_to"
        )
        .not("product_code", "is", null),
      admin
        .from("products")
        .select("slug")
        .in("slug", Array.from(new Set(codes.map((c) => slugify(c))))),
      admin.from("warehouses").select("id, name"),
    ]);
  if (fetchError) return { context: null, error: fetchError.message };

  // Matched case-insensitively — a file's own warehouse column is free text.
  const warehouseIdByName = new Map((warehouseRows ?? []).map((w) => [w.name.trim().toLowerCase(), w.id]));
  function resolveWarehouseId(warehouseName: string | undefined): string | null {
    const named = warehouseName?.trim().toLowerCase();
    if (named && warehouseIdByName.has(named)) return warehouseIdByName.get(named)!;
    return fallbackWarehouseId || null;
  }

  // Keyed case-insensitively — "21202ap" and "21202Ap" are the same part —
  // AND scoped to this import's brand: the same code can legitimately repeat
  // across different brands (rare for product_code, common for origin_code —
  // two aftermarket brands making an equivalent part for the same OEM
  // reference). A match must belong to this brand too, not just share a
  // code, or an Elring import could silently patch an unrelated APLUS row.
  const existingByCode = new Map<string, NonNullable<typeof existingRows>[number]>();
  for (const row of existingRows ?? []) {
    const key = row.product_code?.trim().toLowerCase();
    if (key && row.brand_id === brandId && !existingByCode.has(key)) {
      existingByCode.set(key, row);
    }
  }

  const usedSlugs = new Set((slugRows ?? []).map((r) => r.slug));
  function uniqueSlug(base: string): string {
    let candidate = base;
    let n = 2;
    while (usedSlugs.has(candidate)) candidate = `${base}-${n++}`;
    usedSlugs.add(candidate);
    return candidate;
  }

  return { context: { existingByCode, uniqueSlug, resolveWarehouseId }, error: null };
}

export type ImportPlan = {
  toInsert: Record<string, unknown>[];
  toUpdate: { id: string; code: string; patch: Record<string, unknown> }[];
  unchanged: number;
  codeToProductId: Map<string, string>;
  warehouseAssignments: { code: string; warehouseId: string; quantity: number }[];
};

/** Шаг 2: что сделать с каждой строкой файла. В базу ничего не пишет. */
export function planImportRows(
  validRows: ImportRow[],
  context: ImportContext,
  brandId: string,
  currentYear: number
): ImportPlan {
  const { existingByCode, uniqueSlug, resolveWarehouseId } = context;

  let unchanged = 0;
  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: { id: string; code: string; patch: Record<string, unknown> }[] = [];
  // Maps a product code (lowercased) to the id it ends up as in this run —
  // needed to attach row-conflict log entries to the right product once
  // inserts/updates have actually happened.
  const codeToProductId = new Map<string, string>();
  // Rows that resolved to a warehouse and carry a quantity — applied to
  // warehouse_stock after products exist, once codeToProductId is complete.
  const warehouseAssignments: { code: string; warehouseId: string; quantity: number }[] = [];

  for (const row of validRows) {
    const code = row.productCode;
    const existing = existingByCode.get(code.toLowerCase());
    // A file may map only some of the three name columns — each language
    // falls back to whichever one was actually filled in, and to the product
    // code itself when the file carries no name at all.
    const nameRu = row.nameRu?.trim();
    const nameAz = row.nameAz?.trim();
    const nameKa = row.nameKa?.trim();
    const anyName = nameRu || nameAz || nameKa;
    const nameValue = anyName
      ? { ru: nameRu || anyName, az: nameAz || anyName, ka: nameKa || anyName }
      : { ru: code, az: code, ka: code };
    // Несколько OEM-кодов в ячейке идут через «/» — хранятся так же, первый
    // из них главный (см. lib/oem.ts).
    const originCode = normalizeOem(row.originCode);
    const make = row.make?.trim();
    // "ASTRA H///1,6" — всё после трёх слешей это описание, а не модель.
    // Отдельная колонка описания, если она в файле есть и заполнена, важнее:
    // там осознанный текст, а здесь приписка к модели.
    const { model, description: modelDescription } = splitModelAndDescription(row.model);
    const descriptionText = row.description?.trim() || modelDescription || undefined;
    const years = row.years?.trim();
    const yearFrom = row.yearFrom?.trim();
    const yearTo = row.yearTo?.trim();
    const photoUrl = row.photoUrl?.trim();

    const resolvedWarehouseId = resolveWarehouseId(row.warehouseName);
    if (resolvedWarehouseId && row.stock) {
      warehouseAssignments.push({ code: code.toLowerCase(), warehouseId: resolvedWarehouseId, quantity: row.stock });
    }

    if (!existing) {
      toInsert.push({
        slug: uniqueSlug(slugify(code)),
        category: DEFAULT_CATEGORY,
        ...fitmentColumns(fitmentsFromImport({ make, model, years, yearFrom, yearTo })),
        brand_id: brandId,
        price: row.price ?? 0,
        old_price: null,
        stock: row.stock ?? 0,
        origin_code: originCode || null,
        product_code: code,
        name: nameValue,
        description: { ru: descriptionText ?? "", az: descriptionText ?? "", ka: descriptionText ?? "" },
        specs: [],
        badge: null,
        images: photoUrl ? [photoUrl] : [],
        is_popular: false,
      });
      continue;
    }

    const patch: Record<string, unknown> = {};
    if ((existing.price === 0 || existing.price == null) && row.price) patch.price = row.price;
    if ((existing.stock === 0 || existing.stock == null) && row.stock) patch.stock = row.stock;
    // OEM-коды только дополняются: коды из файла, которых у товара ещё нет,
    // дописываются в конец, а уже стоящий первым главный код не меняется.
    if (originCode) {
      const mergedOem = mergeOem(existing.origin_code, originCode);
      if (mergedOem !== normalizeOem(existing.origin_code)) patch.origin_code = mergedOem;
    }
    // Vehicles follow the same "fill only what's empty" rule, column by column:
    // the file's makes replace a product without one, its models one without
    // models, its years one still on the default range. The result is paired
    // up again as a whole, so the n-th make still meets the n-th model.
    const fillMake = (!existing.make || existing.make === UNIVERSAL_MAKE) && Boolean(make);
    const existingFitments = fitmentsOf({
      ...existing,
      yearFrom: existing.year_from,
      yearTo: existing.year_to,
    });
    // Двигатели в скобках («F10/GT (4,4-4,8)») дополняют товар, у которого
    // их ещё нет, — вместе с моделями из той же ячейки.
    const fillEngines =
      Boolean(model?.includes("(")) && !existingFitments.some((f) => f.engines && f.engines.length > 0);
    const fillModel = (!existing.model && Boolean(model)) || fillEngines;
    const hasNoYears =
      (existing.year_from === OPEN_YEAR_FROM && existing.year_to === OPEN_YEAR_TO) ||
      (existing.year_from === LEGACY_DEFAULT_YEAR_FROM && existing.year_to === currentYear);
    const fillYears = hasNoYears && Boolean(years || yearFrom || yearTo);
    if (fillMake || fillModel || fillYears) {
      const current = fitmentsToFields(existingFitments);
      // Years the product already has are written back as one range per
      // vehicle ("2000-2002; 2010-2015"), which reads as the file's own single
      // year column would; the file's two columns are only consulted when it
      // actually carries them and its years are the ones being filled in.
      const keepYears = !fillYears || !(years || yearFrom || yearTo);
      Object.assign(
        patch,
        fitmentColumns(
          fitmentsFromImport(
            {
              make: fillMake ? make : current.make,
              model: fillModel ? model : current.model,
              years: keepYears ? current.years : years,
              yearFrom: keepYears || years ? undefined : yearFrom,
              yearTo: keepYears || years ? undefined : yearTo,
            }
          )
        )
      );
    }
    if (!existing.brand_id && brandId) patch.brand_id = brandId;
    if ((!existing.images || existing.images.length === 0) && photoUrl) patch.images = [photoUrl];

    if (anyName) {
      const mergedName = mergeImportedName(
        existing.name,
        { ru: nameRu, az: nameAz, ka: nameKa },
        code
      );
      if (mergedName) patch.name = mergedName;
    }

    const descriptionEmpty =
      !existing.description?.ru?.trim() &&
      !existing.description?.az?.trim() &&
      !existing.description?.ka?.trim();
    if (descriptionEmpty && descriptionText) {
      patch.description = { ru: descriptionText, az: descriptionText, ka: descriptionText };
    }

    if (Object.keys(patch).length > 0) {
      toUpdate.push({ id: existing.id, code, patch });
    } else {
      unchanged += 1;
      codeToProductId.set(code.toLowerCase(), existing.id);
    }
  }

  return { toInsert, toUpdate, unchanged, codeToProductId, warehouseAssignments };
}

/** Шаг 3: новые товары и дополнения существующих — пачками по 50. Заполняет
 * codeToProductId для следующих шагов; ошибки копит в errors. */
export async function writeImportedProducts(
  admin: AdminClient,
  toInsert: ImportPlan["toInsert"],
  toUpdate: ImportPlan["toUpdate"],
  codeToProductId: Map<string, string>,
  errors: string[]
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const group of chunk(toInsert, 50)) {
    const { data, error } = await admin.from("products").insert(group).select("id, product_code");
    if (error) {
      errors.push(error.message);
      continue;
    }
    created += data?.length ?? 0;
    for (const row of data ?? []) {
      if (row.product_code) codeToProductId.set(row.product_code.toLowerCase(), row.id);
    }
  }

  for (const group of chunk(toUpdate, 50)) {
    const results = await Promise.all(
      group.map(({ id, code, patch }) =>
        admin
          .from("products")
          .update(patch)
          .eq("id", id)
          .then((res) => ({ ...res, id, code }))
      )
    );
    for (const { error, id, code } of results) {
      if (error) {
        errors.push(error.message);
      } else {
        updated++;
        codeToProductId.set(code.toLowerCase(), id);
      }
    }
  }

  return { created, updated };
}

/** Шаг 4: остатки на складах — только там, где их ещё нет. */
export async function applyWarehouseStock(
  admin: AdminClient,
  warehouseAssignments: ImportPlan["warehouseAssignments"],
  codeToProductId: Map<string, string>,
  errors: string[]
): Promise<number> {
  let warehouseStockSet = 0;
  if (warehouseAssignments.length > 0) {
    const resolvedAssignments = warehouseAssignments
      .map((a) => {
        const productId = codeToProductId.get(a.code);
        if (!productId) return null;
        return { productId, warehouseId: a.warehouseId, quantity: a.quantity };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    if (resolvedAssignments.length > 0) {
      // "Fill only if currently empty" — same rule as every other field this
      // import can touch: an existing non-zero warehouse_stock row (set
      // manually, or by an earlier import) is left alone, not overwritten.
      const { data: existingStock } = await admin
        .from("warehouse_stock")
        .select("product_id, warehouse_id, quantity")
        .in("product_id", Array.from(new Set(resolvedAssignments.map((a) => a.productId))));

      const existingQuantity = new Map(
        (existingStock ?? []).map((s) => [`${s.product_id}:${s.warehouse_id}`, s.quantity])
      );

      const toUpsertStock = resolvedAssignments
        .filter((a) => (existingQuantity.get(`${a.productId}:${a.warehouseId}`) ?? 0) === 0)
        .map((a) => ({ product_id: a.productId, warehouse_id: a.warehouseId, quantity: a.quantity }));

      for (const group of chunk(toUpsertStock, 50)) {
        const { error } = await admin
          .from("warehouse_stock")
          .upsert(group, { onConflict: "warehouse_id,product_id" });
        if (error) errors.push(error.message);
        else warehouseStockSet += group.length;
      }
    }
  }

  return warehouseStockSet;
}

/** Шаг 5: расхождения цен у повторов одного кода — в «Конфликты импорта». */
export async function logImportConflicts(
  admin: AdminClient,
  rowConflicts: ImportRowConflict[],
  codeToProductId: Map<string, string>,
  errors: string[]
): Promise<number> {
  let conflictsLogged = 0;
  if (rowConflicts.length > 0) {
    const conflictRows = rowConflicts
      .map((c) => {
        const productId = codeToProductId.get(c.productCode.toLowerCase());
        if (!productId) return null;
        return {
          product_id: productId,
          product_code: c.productCode,
          origin_code: c.originCode || null,
          field: c.field,
          values: c.values,
          resolved_value: c.resolvedValue,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    for (const group of chunk(conflictRows, 50)) {
      const { error } = await admin.from("import_conflicts").insert(group);
      if (error) errors.push(error.message);
      else conflictsLogged += group.length;
    }
  }

  return conflictsLogged;
}
