/*
 * Экспорт остатков в CSV для Excel — чистые функции, без базы (их проверяют
 * тесты). Сбор данных и права — в stockExportActions.ts.
 *
 * Формат под Excel с русской/азербайджанской/грузинской раскладкой: UTF-8 с
 * BOM (иначе кириллица превращается в «кракозябры»), разделитель «;», дробная
 * часть через запятую.
 */

/** Все колонки в том порядке, в каком они идут в файле. */
export const STOCK_EXPORT_COLUMNS = [
  "productCode",
  "originCode",
  "name",
  "brand",
  "make",
  "model",
  "years",
  "stock",
  "status",
  "price",
  "oldPrice",
  "photo",
] as const;
export type StockExportColumn = (typeof STOCK_EXPORT_COLUMNS)[number];

/** Эти колонки есть в файле всегда — выключить их нельзя. */
export const STOCK_EXPORT_REQUIRED: readonly StockExportColumn[] = ["productCode", "name", "stock", "price"];

export const STOCK_EXPORT_OPTIONAL: readonly StockExportColumn[] = STOCK_EXPORT_COLUMNS.filter(
  (column) => !STOCK_EXPORT_REQUIRED.includes(column)
);

export const STOCK_EXPORT_SCOPES = ["all", "in_stock", "out_of_stock"] as const;
export type StockExportScope = (typeof STOCK_EXPORT_SCOPES)[number];

export type StockExportProduct = {
  productCode: string;
  originCode: string;
  name: string;
  brand: string;
  make: string;
  model: string;
  years: string;
  stock: number;
  price: number;
  oldPrice: number | null;
  photo: string;
};

/** Колонки файла: обязательные плюс выбранные, в порядке STOCK_EXPORT_COLUMNS.
 * Незнакомые значения (подделанный запрос) отбрасываются. */
export function resolveColumns(selected: readonly string[]): StockExportColumn[] {
  return STOCK_EXPORT_COLUMNS.filter(
    (column) => STOCK_EXPORT_REQUIRED.includes(column) || selected.includes(column)
  );
}

export function parseScope(value: string | undefined): StockExportScope {
  return (STOCK_EXPORT_SCOPES as readonly string[]).includes(value ?? "") ? (value as StockExportScope) : "all";
}

/** Сначала то, что есть (больше остаток — выше), потом закончившееся; при
 * равном остатке — по названию, затем по коду. */
export function orderForExport(rows: StockExportProduct[]): StockExportProduct[] {
  return [...rows].sort((a, b) => {
    const aIn = a.stock > 0 ? 0 : 1;
    const bIn = b.stock > 0 ? 0 : 1;
    if (aIn !== bIn) return aIn - bIn;
    if (aIn === 0 && a.stock !== b.stock) return b.stock - a.stock;
    return a.name.localeCompare(b.name) || a.productCode.localeCompare(b.productCode);
  });
}

function formatNumber(value: number): string {
  return String(value).replace(".", ",");
}

/** Одна ячейка CSV.
 *
 * Текст, начинающийся с «=», «+», «-», «@», Excel принял бы за формулу — такой
 * текст из карточки товара мог бы выполниться у того, кто откроет файл. Перед
 * ним ставится апостроф. Числа не трогаются. */
export function csvCell(value: string | number | null): string {
  if (value === null) return "";
  if (typeof value === "number") return formatNumber(value);
  let text = value.replace(/\r\n?/g, "\n");
  if (/^[=+\-@\t\n]/.test(text)) text = `'${text}`;
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Ячейка с кодом (код продукта, OEM). Коды вида «830.489», «403.730» или
 * «12-05» Excel сам переделал бы в число (теряя ноль в конце) или в дату.
 * Такие коды пишутся как ="830.489" — Excel показывает их ровно как есть. */
export function csvCodeCell(value: string): string {
  if (/^[\d\s.,/\-]+$/.test(value) && /\d/.test(value)) return `"=""${value}"""`;
  return csvCell(value);
}

function cellValue(
  product: StockExportProduct,
  column: StockExportColumn,
  status: { inStock: string; outOfStock: string }
): string | number | null {
  switch (column) {
    case "status":
      return product.stock > 0 ? status.inStock : status.outOfStock;
    case "stock":
      return Math.max(0, product.stock);
    default:
      return product[column];
  }
}

/** Готовый текст файла: BOM, строка заголовков, по строке на товар. */
export function buildStockCsv(
  products: StockExportProduct[],
  columns: readonly StockExportColumn[],
  labels: Record<StockExportColumn, string>,
  status: { inStock: string; outOfStock: string }
): string {
  const lines = [columns.map((column) => csvCell(labels[column])).join(";")];
  for (const product of orderForExport(products)) {
    lines.push(
      columns
        .map((column) =>
          column === "productCode" || column === "originCode"
            ? csvCodeCell(product[column])
            : csvCell(cellValue(product, column, status))
        )
        .join(";")
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
