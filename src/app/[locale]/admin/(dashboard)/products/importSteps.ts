import type { createAdminClient } from "@/lib/supabase/admin";
import {
  fitmentColumns,
  fitmentsFromImport,
  splitModelAndDescription,
  fitmentsOf,
  fitmentsToFields,
  type Fitment,
} from "@/lib/fitments";
import { normalizeOem } from "@/lib/oem";
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

/** Все строки запроса — постранично, по 1000 (больше PostgREST за раз не
 * отдаёт). Ошибка любой страницы возвращается, а не проглатывается. */
export async function readAllRows<T>(
  read: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await read(from, from + 999);
    if (error) return { rows, error: error.message };
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return { rows, error: null };
}

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
  // updating it.
  //
  // Постранично: PostgREST отдаёт не больше 1000 строк за запрос. Когда
  // товаров стало больше тысячи, импорт перестал видеть «лишние» — и при
  // повторной загрузке того же файла создавал их заново (дубли).
  const [products, slugs, { data: warehouseRows }] = await Promise.all([
    readAllRows<ExistingProductRow>((from, to) =>
      admin
        .from("products")
        .select(
          "id, product_code, price, stock, origin_code, make, model, fitments, brand_id, images, name, description, year_from, year_to"
        )
        .not("product_code", "is", null)
        .order("id")
        .range(from, to)
    ),
    readAllRows<{ slug: string }>((from, to) =>
      admin.from("products").select("slug").order("id").range(from, to)
    ),
    admin.from("warehouses").select("id, name"),
  ]);
  if (products.error) return { context: null, error: products.error };
  const existingRows = products.rows;
  const wantedSlugs = new Set(codes.map((c) => slugify(c)));
  const slugRows = slugs.rows.filter((row) => wantedSlugs.has(row.slug));

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

/** Дополнение существующего товара: что меняем и что было до этого — по
 * previous откат возвращает товар в прежнее состояние. */
export type PlannedUpdate = {
  id: string;
  code: string;
  patch: Record<string, unknown>;
  previous: Record<string, unknown>;
};

export type ImportPlan = {
  toInsert: Record<string, unknown>[];
  toUpdate: PlannedUpdate[];
  unchanged: number;
  codeToProductId: Map<string, string>;
  warehouseAssignments: { code: string; warehouseId: string; quantity: number }[];
};

/** Шаг 2: что сделать с каждой строкой файла. В базу ничего не пишет. */
export function planImportRows(
  validRows: ImportRow[],
  context: ImportContext,
  brandId: string
): ImportPlan {
  const { existingByCode, uniqueSlug, resolveWarehouseId } = context;

  let unchanged = 0;
  const toInsert: Record<string, unknown>[] = [];
  const toUpdate: PlannedUpdate[] = [];
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

    // Правило: поле, которое в файле выбрано (не «не использовать») и
    // заполнено, перезаписывает значение на сайте, если оно отличается.
    // Невыбранное поле и пустая ячейка товар не трогают.
    const patch: Record<string, unknown> = {};
    if (row.price != null && Number(existing.price) !== row.price) patch.price = row.price;
    if (row.stock != null && existing.stock !== row.stock) patch.stock = row.stock;
    // OEM-коды — по тому же правилу: коды из файла заменяют коды товара
    // целиком (первый из файла становится главным), если они отличаются.
    if (originCode && originCode !== normalizeOem(existing.origin_code)) {
      patch.origin_code = originCode;
    }
    // Машины: что выбрано и заполнено в файле, то и становится машинами
    // товара; невыбранная часть (например, годы) берётся у товара как есть.
    if (make || model || years || yearFrom || yearTo) {
      const existingFitments = fitmentsOf({
        ...existing,
        yearFrom: existing.year_from,
        yearTo: existing.year_to,
      });
      const current = fitmentsToFields(existingFitments);
      const twoYearColumns = !years && Boolean(yearFrom || yearTo);
      const fromFile = fitmentColumns(
        fitmentsFromImport({
          make: make || current.make,
          model: model || current.model,
          years: years || (twoYearColumns ? undefined : current.years),
          yearFrom: twoYearColumns ? yearFrom : undefined,
          yearTo: twoYearColumns ? yearTo : undefined,
        })
      );
      if (JSON.stringify(fromFile.fitments) !== JSON.stringify(existingFitments)) {
        Object.assign(patch, fromFile);
      }
    }
    if (!existing.brand_id && brandId) patch.brand_id = brandId;
    // Фото из файла становится главным; остальные фото товара сохраняются.
    // Картинки, вставленные в сам файл, сюда попадают только для товаров без
    // фото (модалка не загружает их повторно), поэтому повторный импорт того
    // же файла фото не меняет.
    if (photoUrl && (existing.images?.[0] ?? null) !== photoUrl) {
      patch.images = [photoUrl, ...(existing.images ?? []).filter((url) => url !== photoUrl)].slice(0, 4);
    }

    if (anyName) {
      const nextName = {
        ru: nameRu || existing.name?.ru || anyName,
        az: nameAz || existing.name?.az || anyName,
        ka: nameKa || existing.name?.ka || anyName,
      };
      if (
        nextName.ru !== existing.name?.ru ||
        nextName.az !== existing.name?.az ||
        nextName.ka !== existing.name?.ka
      ) {
        patch.name = nextName;
      }
    }

    if (
      descriptionText &&
      (existing.description?.ru !== descriptionText ||
        existing.description?.az !== descriptionText ||
        existing.description?.ka !== descriptionText)
    ) {
      patch.description = { ru: descriptionText, az: descriptionText, ka: descriptionText };
    }

    if (Object.keys(patch).length > 0) {
      // Прежние значения ровно тех полей, что меняются, — для отката.
      const previous: Record<string, unknown> = {};
      for (const key of Object.keys(patch)) {
        previous[key] = (existing as Record<string, unknown>)[key] ?? null;
      }
      toUpdate.push({ id: existing.id, code, patch, previous });
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
): Promise<{
  created: number;
  updated: number;
  /** Что реально записалось — для истории импортов. */
  createdItems: { id: string; code: string }[];
  updatedItems: PlannedUpdate[];
}> {
  let created = 0;
  let updated = 0;
  const createdItems: { id: string; code: string }[] = [];
  const updatedItems: PlannedUpdate[] = [];

  for (const group of chunk(toInsert, 50)) {
    const { data, error } = await admin.from("products").insert(group).select("id, product_code");
    if (error) {
      errors.push(error.message);
      continue;
    }
    created += data?.length ?? 0;
    for (const row of data ?? []) {
      if (row.product_code) codeToProductId.set(row.product_code.toLowerCase(), row.id);
      createdItems.push({ id: row.id, code: row.product_code ?? "" });
    }
  }

  for (const group of chunk(toUpdate, 50)) {
    const results = await Promise.all(
      group.map((item) =>
        admin
          .from("products")
          .update(item.patch)
          .eq("id", item.id)
          .then((res) => ({ ...res, item }))
      )
    );
    for (const { error, item } of results) {
      if (error) {
        errors.push(error.message);
      } else {
        updated++;
        codeToProductId.set(item.code.toLowerCase(), item.id);
        updatedItems.push(item);
      }
    }
  }

  return { created, updated, createdItems, updatedItems };
}

/** Остаток на складе, проставленный импортом; previousQuantity — что было до
 * него (null — строки склада не было). */
export type AppliedStock = {
  productId: string;
  warehouseId: string;
  quantity: number;
  previousQuantity: number | null;
};

/** Шаг 4: остатки на складах — только там, где их ещё нет. */
export async function applyWarehouseStock(
  admin: AdminClient,
  warehouseAssignments: ImportPlan["warehouseAssignments"],
  codeToProductId: Map<string, string>,
  errors: string[]
): Promise<{ count: number; applied: AppliedStock[] }> {
  let warehouseStockSet = 0;
  const applied: AppliedStock[] = [];
  if (warehouseAssignments.length > 0) {
    const resolvedAssignments = warehouseAssignments
      .map((a) => {
        const productId = codeToProductId.get(a.code);
        if (!productId) return null;
        return { productId, warehouseId: a.warehouseId, quantity: a.quantity };
      })
      .filter((a): a is NonNullable<typeof a> => a !== null);

    if (resolvedAssignments.length > 0) {
      // Количество из файла перезаписывает остаток на складе, если отличается
      // (то же правило, что и для остальных выбранных полей).
      const { data: existingStock } = await admin
        .from("warehouse_stock")
        .select("product_id, warehouse_id, quantity")
        .in("product_id", Array.from(new Set(resolvedAssignments.map((a) => a.productId))));

      const existingQuantity = new Map(
        (existingStock ?? []).map((s) => [`${s.product_id}:${s.warehouse_id}`, s.quantity])
      );

      const toUpsertStock = resolvedAssignments
        .filter((a) => existingQuantity.get(`${a.productId}:${a.warehouseId}`) !== a.quantity)
        .map((a) => ({ product_id: a.productId, warehouse_id: a.warehouseId, quantity: a.quantity }));

      for (const group of chunk(toUpsertStock, 50)) {
        const { error } = await admin
          .from("warehouse_stock")
          .upsert(group, { onConflict: "warehouse_id,product_id" });
        if (error) {
          errors.push(error.message);
          continue;
        }
        warehouseStockSet += group.length;
        for (const row of group) {
          const key = `${row.product_id}:${row.warehouse_id}`;
          applied.push({
            productId: row.product_id,
            warehouseId: row.warehouse_id,
            quantity: row.quantity,
            previousQuantity: existingQuantity.has(key) ? existingQuantity.get(key)! : null,
          });
        }
      }
    }
  }

  return { count: warehouseStockSet, applied };
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
