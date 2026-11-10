/*
 * Шаг импорта «заменить / прибавить» — для товаров, которые уже есть у бренда
 * и в файле отличаются (цена, остаток, фото, название …).
 *
 * Импорт сначала создаёт только новые товары. Отличающиеся существующие он не
 * трогает, а показывает списком: админ решает, что с ними сделать — заменить
 * всё, прибавить остаток к имеющемуся или выбрать по товарам и по полям.
 *
 * Здесь только чистые функции (их проверяют тесты): какие поля отличаются и
 * какой патч получится из решения админа. Запись в базу — в importActions.ts.
 */

import { fitmentsOf, fitmentsToFields } from "@/lib/fitments";
import type { ExistingProductRow, PlannedUpdate } from "./importSteps";

/** Поля, которые можно заменить по отдельности. */
export const MERGE_FIELDS = ["price", "stock", "photo", "name", "originCode", "vehicles", "description"] as const;
export type MergeField = (typeof MERGE_FIELDS)[number];

/** Остаток: заменить числом из файла, прибавить его к имеющемуся или не трогать. */
export type StockMode = "replace" | "add" | "skip";

/** Решение по одному товару. */
export type MergeDecision = {
  code: string;
  /** Какие поля заменить (остаток — отдельно, через stockMode). */
  fields: MergeField[];
  stockMode: StockMode;
};

/** Одно отличие — для показа в окне выбора. */
export type ImportChange = { field: MergeField; current: string; next: string };

/** Существующий товар, который отличается от файла и ждёт решения. */
export type ImportPendingUpdate = {
  productId: string;
  code: string;
  name: string;
  image: string | null;
  /** Остаток сейчас и в файле — для «прибавить» (null — в файле нет остатка). */
  currentStock: number;
  fileStock: number | null;
  changes: ImportChange[];
};

/** Какие колонки товара относятся к полю. */
const FIELD_COLUMNS: Record<MergeField, string[]> = {
  price: ["price"],
  stock: ["stock"],
  photo: ["images"],
  name: ["name"],
  originCode: ["origin_code"],
  vehicles: ["fitments", "make", "model", "year_from", "year_to"],
  description: ["description"],
};

function fieldOfColumn(column: string): MergeField | null {
  for (const field of MERGE_FIELDS) if (FIELD_COLUMNS[field].includes(column)) return field;
  return null;
}

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}

function localizedText(value: unknown): string {
  const v = value as { ru?: string; az?: string; ka?: string } | null;
  return v?.ru || v?.az || v?.ka || "";
}

function vehiclesText(row: Pick<ExistingProductRow, "fitments" | "make" | "model" | "year_from" | "year_to">): string {
  const fields = fitmentsToFields(fitmentsOf({ ...row, yearFrom: row.year_from, yearTo: row.year_to }));
  return [fields.make, fields.model, fields.years].filter(Boolean).join(" · ");
}

/** Отличия товара от файла — по полям, в порядке MERGE_FIELDS. */
export function describeChanges(update: PlannedUpdate, existing: ExistingProductRow): ImportChange[] {
  const changes: ImportChange[] = [];
  const patch = update.patch;
  for (const field of MERGE_FIELDS) {
    if (!FIELD_COLUMNS[field].some((column) => column in patch)) continue;
    switch (field) {
      case "price":
        changes.push({ field, current: text(existing.price), next: text(patch.price) });
        break;
      case "stock":
        changes.push({ field, current: text(existing.stock ?? 0), next: text(patch.stock) });
        break;
      case "photo":
        changes.push({
          field,
          current: existing.images?.[0] ?? "",
          next: (patch.images as string[] | undefined)?.[0] ?? "",
        });
        break;
      case "name":
        changes.push({ field, current: localizedText(existing.name), next: localizedText(patch.name) });
        break;
      case "originCode":
        changes.push({ field, current: text(existing.origin_code), next: text(patch.origin_code) });
        break;
      case "vehicles":
        changes.push({
          field,
          current: vehiclesText(existing),
          next: vehiclesText({ ...existing, ...(patch as Partial<ExistingProductRow>) }),
        });
        break;
      case "description":
        changes.push({
          field,
          current: localizedText(existing.description),
          next: localizedText(patch.description),
        });
        break;
    }
  }
  return changes;
}

/**
 * Патч по решению админа — или null, если менять нечего.
 *
 *  - поля не из `fields` из патча убираются (товар их сохраняет);
 *  - остаток: «заменить» — число из файла, «прибавить» — имеющийся остаток
 *    плюс число из файла, «не трогать» — без изменений;
 *  - previous — прежние значения ровно тех колонок, что меняются: по ним
 *    откат импорта вернёт товар как было.
 */
export function applyDecision(
  update: PlannedUpdate,
  existing: Pick<ExistingProductRow, "stock">,
  fileStock: number | null | undefined,
  decision: Pick<MergeDecision, "fields" | "stockMode">
): PlannedUpdate | null {
  const patch: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(update.patch)) {
    const field = fieldOfColumn(column);
    if (field === "stock") continue;
    // Колонки вне полей (brand_id у товара без бренда) идут как раньше.
    if (field === null || decision.fields.includes(field)) patch[column] = value;
  }

  if (fileStock != null && Number.isFinite(fileStock)) {
    const current = existing.stock ?? 0;
    if (decision.stockMode === "replace" && fileStock !== current) patch.stock = fileStock;
    if (decision.stockMode === "add" && fileStock !== 0) patch.stock = Math.max(0, current + fileStock);
  }

  if (Object.keys(patch).length === 0) return null;
  const previous: Record<string, unknown> = {};
  for (const column of Object.keys(patch)) {
    previous[column] = column === "stock" ? existing.stock ?? null : update.previous[column] ?? null;
  }
  return { id: update.id, code: update.code, patch, previous };
}

/** Новый остаток на складе по решению — или null, если не менять. */
export function mergeWarehouseQuantity(
  current: number | null,
  fileQuantity: number,
  stockMode: StockMode
): number | null {
  if (stockMode === "skip") return null;
  if (stockMode === "add") return fileQuantity === 0 ? null : Math.max(0, (current ?? 0) + fileQuantity);
  return current === fileQuantity ? null : fileQuantity;
}

/** Решение «ко всем»: все отличающиеся поля заменить, остаток — как выбрано. */
export function decisionForAll(pending: ImportPendingUpdate[], stockMode: StockMode): MergeDecision[] {
  return pending.map((item) => ({
    code: item.code,
    fields: MERGE_FIELDS.filter((field) => field !== "stock"),
    stockMode,
  }));
}
