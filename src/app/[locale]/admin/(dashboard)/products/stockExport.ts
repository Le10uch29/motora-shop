/*
 * Экспорт остатков для Excel — чистые функции, без базы (их проверяют тесты).
 * Сбор данных и права — в stockExportActions.ts, сборка файла — в модалке.
 *
 * Файл — .xlsx (buildStockTable + lib/xlsxWriter): в CSV Excel угадывал
 * кодировку по настройкам Windows, и названия местами превращались в
 * «иероглифы», а фото там могли быть только ссылками. CSV-функции ниже
 * остались для совместимости и тестов.
 */

import type { XlsxCell, XlsxColumn } from "@/lib/xlsxWriter";

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

/** Какие товары выгружать: все, в наличии (остаток больше 0), закончившиеся
 * (остаток 0) или заканчивающиеся (остаток от 1 и меньше LOW_STOCK_THRESHOLD — тот
 * же порог, что у фильтра «Заканчиваются» в списке товаров и на главной
 * админки). */
export const STOCK_EXPORT_SCOPES = ["all", "in_stock", "out_of_stock", "low_stock"] as const;
export type StockExportScope = (typeof STOCK_EXPORT_SCOPES)[number];

export type StockExportProduct = {
  /** id товара — по нему подгружаются фото для файла. */
  id?: string;
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

/** Ширина колонки в файле (в символах Excel) и тип значения в ней. */
const XLSX_COLUMN: Record<StockExportColumn, Omit<XlsxColumn, "header">> = {
  productCode: { width: 16, kind: "text" },
  originCode: { width: 18, kind: "text" },
  name: { width: 45, kind: "text" },
  brand: { width: 16, kind: "text" },
  make: { width: 18, kind: "text" },
  model: { width: 22, kind: "text" },
  years: { width: 12, kind: "text" },
  stock: { width: 10, kind: "int" },
  status: { width: 14, kind: "text" },
  price: { width: 12, kind: "money" },
  oldPrice: { width: 12, kind: "money" },
  // В ячейке — сама картинка (её кладёт модалка), не ссылка.
  photo: { width: 13, kind: "text" },
};

/** Высота строки, когда в файле есть фото: картинка ~72px. */
export const STOCK_EXPORT_PHOTO_ROW_HEIGHT = 60;

/**
 * Таблица для .xlsx: колонки, строки в порядке orderForExport и id товаров —
 * по ним модалка подгружает фото. Ячейка «Фото» остаётся пустой: картинку
 * кладут поверх неё, а ссылки в файле не нужны.
 *
 * Коды остаются текстом, и Excel их не переделывает в числа и даты; текст,
 * похожий на формулу, тоже просто текст — в .xlsx он не выполняется.
 */
export function buildStockTable(
  products: StockExportProduct[],
  columns: readonly StockExportColumn[],
  labels: Record<StockExportColumn, string>,
  status: { inStock: string; outOfStock: string }
): {
  columns: XlsxColumn[];
  rows: XlsxCell[][];
  /** По строке: id товара, если у него есть фото, иначе null. */
  photoIds: (string | null)[];
  /** Номер колонки «Фото» или -1, если её не выбрали. */
  photoCol: number;
} {
  const ordered = orderForExport(products);
  return {
    columns: columns.map((column) => ({ header: labels[column], ...XLSX_COLUMN[column] })),
    rows: ordered.map((product) =>
      columns.map((column) => (column === "photo" ? null : cellValue(product, column, status)))
    ),
    photoIds: ordered.map((product) => (product.photo && product.id ? product.id : null)),
    photoCol: columns.indexOf("photo"),
  };
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
