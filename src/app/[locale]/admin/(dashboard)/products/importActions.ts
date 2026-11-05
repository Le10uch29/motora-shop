"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAction } from "@/lib/logs";
import { PRODUCTS_CACHE_TAG } from "@/lib/productFilterMeta";
import { storeProductImage } from "@/lib/productImageStorage";
import type { Locale } from "@/i18n/locales";
import { mergeDuplicateImportRows, type ImportRow } from "./importRows";
import {
  applyWarehouseStock,
  loadImportContext,
  logImportConflicts,
  planImportRows,
  readAllRows,
  writeImportedProducts,
} from "./importSteps";
import type { ImportPreview, ImportResult } from "./productTypes";
import { recordImportRun } from "./importHistory";

/** Uploads pictures that were embedded in the imported spreadsheet and hands
 * back their public URLs, in the same order the files came in.
 *
 * Separate from importProductsAction, and called in batches, because the rows
 * of a price list are small while its photos are not — sending a few hundred
 * of them alongside the row data would blow past the request size limit in one
 * go. The import itself then only ever deals in URLs, exactly as it does for a
 * spreadsheet whose photo column holds links. */
export async function uploadImportPhotosAction(
  locale: Locale,
  formData: FormData
): Promise<{ urls: string[]; error: string | null }> {
  await requireAdmin(locale);
  const admin = createAdminClient();

  // A file full of photos means hundreds of uploads, so the batch goes up in
  // parallel rather than one at a time; the results stay in the order they
  // came in, which is what pairs each URL back with its row.
  const uploads = formData.getAll("photos").map(async (entry) => {
    if (!(entry instanceof File) || entry.size === 0) return "";
    return storeProductImage(admin, new Uint8Array(await entry.arrayBuffer()), {
      name: entry.name,
      contentType: entry.type || "image/png",
    });
  });

  try {
    return { urls: await Promise.all(uploads), error: null };
  } catch (error) {
    return { urls: [], error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Of the given product codes, the ones that already have a picture in this
 * brand.
 *
 * An import never replaces a photo a product already has, so sending its
 * picture up would only leave an unused file behind in storage — and running
 * the same file a second time would copy every photo in it all over again.
 * Asking first keeps a repeat import quick and the bucket clean.
 */
export async function findProductCodesWithPhotoAction(
  locale: Locale,
  brandId: string,
  codes: string[]
): Promise<string[]> {
  await requireAdmin(locale);
  const admin = createAdminClient();

  const wanted = new Set(codes.map((code) => code.trim().toLowerCase()).filter(Boolean));
  if (wanted.size === 0) return [];

  // Read unfiltered for the same reason the import itself does: `.in()` is
  // case-sensitive and would miss a stored "21202Ap" for a file's "21202ap".
  // Постранично: больше 1000 строк за раз база не отдаёт, и товары за этой
  // границей считались «без фото» — их фото загружались заново.
  const { rows: data, error } = await readAllRows<{
    product_code: string | null;
    images: string[] | null;
    brand_id: string | null;
  }>((from, to) =>
    admin
      .from("products")
      .select("product_code, images, brand_id")
      .not("product_code", "is", null)
      .order("id")
      .range(from, to)
  );
  // On failure nothing is reported as photographed: the import still works,
  // it just uploads pictures it may not need.
  if (error) return [];

  const found: string[] = [];
  for (const row of data ?? []) {
    const key = row.product_code?.trim().toLowerCase();
    if (!key || row.brand_id !== brandId || !wanted.has(key)) continue;
    if (Array.isArray(row.images) && row.images.length > 0) found.push(key);
  }
  return found;
}

/** Excel-импорт товаров одного бренда. Сами шаги — в importSteps.ts. */
export async function importProductsAction(
  locale: Locale,
  brandId: string,
  rows: ImportRow[],
  fallbackWarehouseId?: string,
  /** Имя загруженного файла — для «Истории импортов». */
  fileName?: string
): Promise<ImportResult> {
  const actor = await requireAdmin(locale);
  const admin = createAdminClient();

  const validRowsRaw = rows.filter((r) => r.productCode.trim().length > 0);
  const skipped = rows.length - validRowsRaw.length;
  if (validRowsRaw.length === 0) {
    return { created: 0, updated: 0, skipped, conflicts: 0, warehouseStockSet: 0, unchanged: 0, error: null };
  }

  const { rows: validRows, conflicts: rowConflicts } = mergeDuplicateImportRows(validRowsRaw);
  const codes = validRows.map((r) => r.productCode);

  const loaded = await loadImportContext(admin, brandId, codes, fallbackWarehouseId);
  if (loaded.error !== null) {
    return {
      created: 0,
      updated: 0,
      skipped: rows.length,
      conflicts: 0,
      warehouseStockSet: 0,
      unchanged: 0,
      error: loaded.error,
    };
  }

  const { toInsert, toUpdate, unchanged, codeToProductId, warehouseAssignments } = planImportRows(
    validRows,
    loaded.context,
    brandId
  );

  const errors: string[] = [];
  const { created, updated, createdItems, updatedItems } = await writeImportedProducts(
    admin,
    toInsert,
    toUpdate,
    codeToProductId,
    errors
  );
  const { count: warehouseStockSet, applied: appliedStock } = await applyWarehouseStock(
    admin,
    warehouseAssignments,
    codeToProductId,
    errors
  );
  const conflictsLogged = await logImportConflicts(admin, rowConflicts, codeToProductId, errors);

  // Шаг 6: запись в «Историю импортов» — по ней импорт можно откатить или
  // перенести его товары на другой бренд. Если не удалась, импорт всё равно
  // прошёл: возвращаем предупреждение, а не ошибку.
  const [{ data: brandRow }, { data: warehouseRow }] = await Promise.all([
    admin.from("brands").select("name").eq("id", brandId).maybeSingle(),
    fallbackWarehouseId
      ? admin.from("warehouses").select("name").eq("id", fallbackWarehouseId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const history = await recordImportRun(
    admin,
    {
      brandId,
      brandName: brandRow?.name ?? "—",
      warehouseId: fallbackWarehouseId || null,
      warehouseName: warehouseRow?.name ?? null,
      fileName: fileName?.trim() || null,
      staffId: actor.id,
      staffName: `${actor.firstName} ${actor.lastName}`.trim(),
      created,
      updated,
      unchanged,
      skipped,
      conflicts: conflictsLogged,
      stock: warehouseStockSet,
    },
    createdItems,
    updatedItems,
    appliedStock
  );

  await logAction(
    actor,
    "create",
    "product",
    `Импорт Excel: ${created} новых, ${updated} обновлено, ${unchanged} без изменений, ${skipped} пропущено, ${conflictsLogged} конфликтов, склад проставлен для ${warehouseStockSet}`,
    {}
  );
  revalidatePath(`/${locale}/admin/products`);
  revalidatePath(`/${locale}/catalog`);
  updateTag(PRODUCTS_CACHE_TAG);
  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/admin/warehouses`);

  return {
    created,
    updated,
    skipped,
    conflicts: conflictsLogged,
    warehouseStockSet,
    unchanged,
    error: errors.length > 0 ? errors.join("; ") : null,
    runId: history.runId,
    historyWarning: history.error,
  };
}

/**
 * Что сделает импорт, если его запустить, — без записи в базу.
 *
 * Те же шаги, что и у самого импорта (склейка повторов, загрузка того, что
 * есть у бренда, план по строкам), поэтому цифры совпадают с настоящим
 * запуском. Плюс страховка от выбора не того бренда: сколько кодов из файла
 * уже есть у ДРУГИХ брендов.
 */
export async function previewImportAction(
  locale: Locale,
  brandId: string,
  rows: ImportRow[],
  fallbackWarehouseId?: string
): Promise<ImportPreview> {
  await requireAdmin(locale);
  const admin = createAdminClient();
  const empty: ImportPreview = {
    brandName: "—",
    create: 0,
    update: 0,
    unchanged: 0,
    skipped: 0,
    otherBrandMatches: [],
    error: null,
  };

  const { data: brandRow } = await admin.from("brands").select("name").eq("id", brandId).maybeSingle();
  const brandName = brandRow?.name ?? "—";

  const validRowsRaw = rows.filter((r) => r.productCode.trim().length > 0);
  const skipped = rows.length - validRowsRaw.length;
  if (validRowsRaw.length === 0) return { ...empty, brandName, skipped };

  const { rows: validRows } = mergeDuplicateImportRows(validRowsRaw);
  const codes = validRows.map((r) => r.productCode);
  const loaded = await loadImportContext(admin, brandId, codes, fallbackWarehouseId);
  if (loaded.error !== null) return { ...empty, brandName, skipped, error: loaded.error };

  const plan = planImportRows(validRows, loaded.context, brandId);

  // Коды файла, которые есть у других брендов. Чтение без фильтра по коду —
  // как и в самом импорте: .in() чувствителен к регистру.
  const wanted = new Set(codes.map((code) => code.trim().toLowerCase()));
  const { rows: others } = await readAllRows<{
    product_code: string | null;
    brands: { name: string } | { name: string }[] | null;
  }>((from, to) =>
    admin
      .from("products")
      .select("product_code, brand_id, brands(name)")
      .not("product_code", "is", null)
      .neq("brand_id", brandId)
      .order("id")
      .range(from, to)
  );
  const byBrand = new Map<string, Set<string>>();
  for (const row of others ?? []) {
    const code = row.product_code?.trim().toLowerCase();
    if (!code || !wanted.has(code)) continue;
    const brand = Array.isArray(row.brands) ? row.brands[0] : row.brands;
    const name = (brand as { name?: string } | null)?.name ?? "—";
    if (!byBrand.has(name)) byBrand.set(name, new Set());
    byBrand.get(name)!.add(code);
  }

  return {
    brandName,
    create: plan.toInsert.length,
    update: plan.toUpdate.length,
    unchanged: plan.unchanged,
    skipped,
    otherBrandMatches: [...byBrand.entries()]
      .map(([name, set]) => ({ brandName: name, count: set.size }))
      .sort((a, b) => b.count - a.count),
    error: null,
  };
}
