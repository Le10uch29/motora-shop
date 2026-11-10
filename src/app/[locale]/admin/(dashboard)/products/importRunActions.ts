"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/paginate";
import { logAction } from "@/lib/logs";
import { PRODUCTS_CACHE_TAG } from "@/lib/productFilterMeta";
import type { Locale } from "@/i18n/locales";
import { chunk } from "./importSteps";
import type { ImportRunActionResult } from "./productTypes";

/*
 * Действия «Истории импортов»: откат импорта и перенос созданных им товаров
 * на другой бренд. Только админ.
 *
 * Общее правило безопасности: товар, изменённый ПОСЛЕ импорта (правили
 * вручную, списали со склада при отправке заказа), откат не трогает — иначе
 * он стёр бы чужую работу. Граница — время записи импорта в историю (время
 * базы), а после переноса на бренд — время переноса.
 */

type RunItem = {
  product_id: string | null;
  product_code: string;
  action: "created" | "updated";
  previous: Record<string, unknown> | null;
};

type AdminClient = ReturnType<typeof createAdminClient>;

function revalidateCatalog(locale: Locale) {
  revalidatePath(`/${locale}/admin/products`);
  revalidatePath(`/${locale}/admin/products/imports`);
  revalidatePath(`/${locale}/admin/warehouses`);
  revalidatePath(`/${locale}/catalog`);
  revalidatePath(`/${locale}`);
  updateTag(PRODUCTS_CACHE_TAG);
}

async function readRunItems(admin: AdminClient, runId: string): Promise<RunItem[]> {
  return readAllPages<RunItem>((from, to) =>
    admin
      .from("import_run_items")
      .select("product_id, product_code, action, previous")
      .eq("run_id", runId)
      .order("id")
      .range(from, to)
  );
}

/** Текущее состояние товаров импорта, пачками — список id может быть длинным. */
async function readProducts(
  admin: AdminClient,
  ids: string[]
): Promise<Map<string, { updated_at: string; product_code: string | null; brand_id: string | null }>> {
  const byId = new Map<string, { updated_at: string; product_code: string | null; brand_id: string | null }>();
  for (const group of chunk(ids, 200)) {
    const { data } = await admin
      .from("products")
      .select("id, updated_at, product_code, brand_id")
      .in("id", group);
    for (const row of data ?? []) byId.set(row.id, row);
  }
  return byId;
}

const emptyResult: ImportRunActionResult = {
  error: null,
  done: 0,
  restored: 0,
  stockRestored: 0,
  skipped: [],
};

/**
 * Откатывает импорт:
 *  - созданные им товары удаляет (если их не правили после импорта и их нет
 *    в заказах);
 *  - дополненным товарам возвращает прежние значения полей (если их не
 *    правили после импорта);
 *  - проставленные им остатки на складах возвращает как было (если остаток
 *    с тех пор не менялся).
 * Пропущенное возвращается списком — с причиной.
 */
export async function rollbackImportAction(
  locale: Locale,
  runId: string
): Promise<ImportRunActionResult> {
  const actor = await requireAdmin(locale);
  const admin = createAdminClient();

  type RunRow = {
    id: string;
    status: string;
    created_at: string;
    moved_at: string | null;
    merged_at?: string | null;
    brand_name: string;
    file_name: string | null;
  };
  // merged_at может ещё не быть (SQL шага «заменить / прибавить» не выполнен).
  const withMerge = await admin
    .from("import_runs")
    .select("id, status, created_at, moved_at, merged_at, brand_name, file_name")
    .eq("id", runId)
    .maybeSingle();
  const { data: run } = (
    withMerge.error
      ? await admin
          .from("import_runs")
          .select("id, status, created_at, moved_at, brand_name, file_name")
          .eq("id", runId)
          .maybeSingle()
      : withMerge
  ) as { data: RunRow | null };
  if (!run) return { ...emptyResult, error: "not_found" };
  if (run.status === "rolled_back") return { ...emptyResult, error: "already_rolled_back" };
  // Граница «правили после импорта» — самое позднее из: запись импорта,
  // перенос на бренд, шаг «заменить / прибавить» (всё это — сам импорт).
  const boundary = Math.max(
    ...[run.created_at, run.moved_at, run.merged_at]
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
  );

  const items = await readRunItems(admin, runId);
  const products = await readProducts(
    admin,
    items.map((item) => item.product_id).filter((id): id is string => Boolean(id))
  );

  // Созданные товары, которые уже попали в заказы, не удаляются: заказ
  // сохранился бы, но потерял связь с товаром.
  const createdIds = items
    .filter((item) => item.action === "created" && item.product_id)
    .map((item) => item.product_id!);
  const inOrders = new Set<string>();
  for (const group of chunk(createdIds, 200)) {
    const { data } = await admin.from("orders").select("product_id").in("product_id", group);
    for (const row of data ?? []) if (row.product_id) inOrders.add(row.product_id);
  }

  const skipped: ImportRunActionResult["skipped"] = [];
  const toDelete: string[] = [];
  const toRestore: { id: string; previous: Record<string, unknown> }[] = [];
  for (const item of items) {
    const product = item.product_id ? products.get(item.product_id) : undefined;
    if (!item.product_id || !product) {
      skipped.push({ code: item.product_code, reason: "deleted" });
    } else if (new Date(product.updated_at).getTime() > boundary) {
      skipped.push({ code: item.product_code, reason: "edited" });
    } else if (item.action === "created") {
      if (inOrders.has(item.product_id)) skipped.push({ code: item.product_code, reason: "in_orders" });
      else toDelete.push(item.product_id);
    } else if (item.previous && Object.keys(item.previous).length > 0) {
      toRestore.push({ id: item.product_id, previous: item.previous });
    }
  }

  // Остатки на складах — первыми: строки удаляемых товаров уйдут каскадом,
  // их трогать незачем. Возвращаем, только если остаток не менялся.
  const deleting = new Set(toDelete);
  const { data: stockRows } = await admin
    .from("import_run_stock")
    .select("product_id, warehouse_id, quantity, previous_quantity")
    .eq("run_id", runId);
  let stockRestored = 0;
  for (const row of stockRows ?? []) {
    if (deleting.has(row.product_id)) continue;
    const { data: current } = await admin
      .from("warehouse_stock")
      .select("id, quantity")
      .eq("product_id", row.product_id)
      .eq("warehouse_id", row.warehouse_id)
      .maybeSingle();
    if (!current || current.quantity !== row.quantity) continue;
    const { error } =
      row.previous_quantity === null
        ? await admin.from("warehouse_stock").delete().eq("id", current.id)
        : await admin.from("warehouse_stock").update({ quantity: row.previous_quantity }).eq("id", current.id);
    if (!error) stockRestored++;
  }

  let restored = 0;
  for (const group of chunk(toRestore, 50)) {
    const results = await Promise.all(
      group.map(({ id, previous }) => admin.from("products").update(previous).eq("id", id))
    );
    restored += results.filter((result) => !result.error).length;
  }

  let deleted = 0;
  for (const group of chunk(toDelete, 200)) {
    const { error, count } = await admin.from("products").delete({ count: "exact" }).in("id", group);
    if (error) return { error: error.message, done: deleted, restored, stockRestored, skipped };
    deleted += count ?? group.length;
  }

  await admin
    .from("import_runs")
    .update({
      status: "rolled_back",
      rolled_back_at: new Date().toISOString(),
      rolled_back_by: `${actor.firstName} ${actor.lastName}`.trim(),
    })
    .eq("id", runId);

  await logAction(
    actor,
    "delete",
    "product",
    `Откат импорта Excel (${run.brand_name}${run.file_name ? `, ${run.file_name}` : ""}): удалено ${deleted}, возвращено ${restored}, пропущено ${skipped.length}`,
    { entityId: runId }
  );
  revalidateCatalog(locale);
  return { error: null, done: deleted, restored, stockRestored, skipped };
}

/**
 * Переносит СОЗДАННЫЕ импортом товары на другой бренд — когда при импорте
 * был выбран не тот бренд (файл Elring загрузили в APLUS).
 *
 * Дополненные импортом существующие товары не переносятся: они и раньше
 * принадлежали выбранному бренду. Их число возвращается в leftUpdated —
 * если дополнение было ошибочным, его можно откатить отдельно.
 * Товар не переносится, если у нового бренда уже есть товар с тем же кодом:
 * получился бы дубль.
 */
export async function changeImportBrandAction(
  locale: Locale,
  runId: string,
  targetBrandId: string
): Promise<ImportRunActionResult> {
  const actor = await requireAdmin(locale);
  const admin = createAdminClient();

  const [{ data: run }, { data: target }] = await Promise.all([
    admin.from("import_runs").select("id, status, brand_name").eq("id", runId).maybeSingle(),
    admin.from("brands").select("id, name").eq("id", targetBrandId).maybeSingle(),
  ]);
  if (!run) return { ...emptyResult, error: "not_found" };
  if (run.status === "rolled_back") return { ...emptyResult, error: "already_rolled_back" };
  if (!target) return { ...emptyResult, error: "brand_not_found" };

  const items = await readRunItems(admin, runId);
  const created = items.filter((item) => item.action === "created");
  const leftUpdated = items.length - created.length;
  const products = await readProducts(
    admin,
    created.map((item) => item.product_id).filter((id): id is string => Boolean(id))
  );

  // Коды, которые у нового бренда уже есть, — без учёта регистра, как в импорте.
  const targetCodes = new Set(
    (
      await readAllPages<{ product_code: string | null }>((from, to) =>
        admin.from("products").select("product_code").eq("brand_id", targetBrandId).range(from, to)
      )
    )
      .map((row) => row.product_code?.trim().toLowerCase())
      .filter((code): code is string => Boolean(code))
  );

  const skipped: ImportRunActionResult["skipped"] = [];
  const toMove: string[] = [];
  for (const item of created) {
    const product = item.product_id ? products.get(item.product_id) : undefined;
    if (!item.product_id || !product) {
      skipped.push({ code: item.product_code, reason: "deleted" });
    } else if (product.brand_id === targetBrandId) {
      continue;
    } else if (targetCodes.has((product.product_code ?? item.product_code).trim().toLowerCase())) {
      skipped.push({ code: item.product_code, reason: "duplicate" });
    } else {
      toMove.push(item.product_id);
    }
  }

  let moved = 0;
  let movedAt: string | null = null;
  for (const group of chunk(toMove, 200)) {
    const { data, error } = await admin
      .from("products")
      .update({ brand_id: targetBrandId })
      .in("id", group)
      .select("updated_at");
    if (error) return { error: error.message, done: moved, restored: 0, stockRestored: 0, skipped, leftUpdated };
    moved += data?.length ?? 0;
    // Время переноса берём у самих товаров (время базы): это новая граница
    // «правили после импорта» для отката.
    for (const row of data ?? []) if (!movedAt || row.updated_at > movedAt) movedAt = row.updated_at;
  }

  if (moved > 0) {
    await admin
      .from("import_runs")
      .update({ moved_to_brand_id: target.id, moved_to_brand_name: target.name, moved_at: movedAt })
      .eq("id", runId);
  }

  await logAction(
    actor,
    "update",
    "product",
    `Импорт Excel перенесён с бренда ${run.brand_name} на ${target.name}: ${moved} товаров, пропущено ${skipped.length}`,
    { entityId: runId }
  );
  revalidateCatalog(locale);
  return { error: null, done: moved, restored: 0, stockRestored: 0, skipped, leftUpdated };
}
