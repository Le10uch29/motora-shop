/** Типы результатов server actions раздела «Товары». Отдельным модулем: файл с
 * "use server" может экспортировать только async-функции. */

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
