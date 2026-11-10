/** Типы результатов server actions раздела «Товары». Отдельным модулем: файл с
 * "use server" может экспортировать только async-функции. */

import type { ImportPendingUpdate } from "./importMerge";

export type ProductActionState = { error: string | null };

export type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  conflicts: number;
  warehouseStockSet: number;
  /** Products matched by code whose every mapped field was already filled —
   * nothing to change. Reported so an import that legitimately does nothing
   * reads as "already up to date" instead of an unexplained 0 / 0. */
  unchanged: number;
  error: string | null;
  /** Запись в «Истории импортов» — по ней импорт можно откатить. */
  runId?: string | null;
  /** История не записалась (например, SQL с таблицами истории ещё не
   * выполнен) — сам импорт при этом прошёл. */
  historyWarning?: string | null;
  /** Существующие товары, которые в файле отличаются: импорт их не менял и
   * ждёт решения «заменить / прибавить» (applyImportMergeAction). */
  pending?: ImportPendingUpdate[];
};

/** Что сделает импорт, если его запустить, — без записи в базу. */
export type ImportPreview = {
  brandName: string;
  create: number;
  update: number;
  unchanged: number;
  skipped: number;
  /** Коды из файла, которые уже есть у ДРУГИХ брендов: признак того, что
   * для импорта, возможно, выбран не тот бренд. */
  otherBrandMatches: { brandName: string; count: number }[];
  error: string | null;
};

/** Один запуск импорта в «Истории импортов». */
export type ImportRunRow = {
  id: string;
  createdAt: string;
  staffName: string;
  fileName: string | null;
  brandName: string;
  warehouseName: string | null;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  conflicts: number;
  stock: number;
  status: "done" | "rolled_back";
  rolledBackAt: string | null;
  rolledBackBy: string | null;
  movedToBrandName: string | null;
  movedAt: string | null;
};

/** Итог отката или переноса на другой бренд: что сделано и что пропущено. */
export type ImportRunActionResult = {
  error: string | null;
  done: number;
  restored: number;
  stockRestored: number;
  skipped: { code: string; reason: "edited" | "in_orders" | "deleted" | "duplicate" }[];
  /** Перенос на бренд: сколько СУЩЕСТВУЮЩИХ товаров этот импорт только
   * дополнил — они не переносятся (они и были у того бренда). */
  leftUpdated?: number;
};

export type ImportConflictRow = {
  id: string;
  productId: string | null;
  productCode: string;
  originCode: string | null;
  field: string;
  values: string[];
  resolvedValue: string;
  createdAt: string;
  productName: string | null;
  productSlug: string | null;
};

export type ProductCompletenessRow = {
  id: string;
  productCode: string;
  originCode: string;
  price: number;
  displayName: string;
};
