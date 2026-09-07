"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { importProductsAction, type ImportRow, type ImportResult } from "./actions";
import type { Locale } from "@/i18n/locales";
import type { Dictionary } from "@/i18n/dictionary";

type FieldKey =
  | "productCode"
  | "originCode"
  | "price"
  | "stock"
  | "nameRu"
  | "nameAz"
  | "nameKa"
  | "description"
  | "make"
  | "model"
  | "photoUrl"
  | "yearFrom"
  | "yearTo"
  | "warehouse";

/** The three name columns get their own row in the mapping UI, so they're
 * not mistaken for one another or for the rest of the columns. */
const NAME_FIELDS: FieldKey[] = ["nameRu", "nameAz", "nameKa"];

const FIELD_ORDER: FieldKey[] = [
  "productCode",
  "originCode",
  "price",
  "stock",
  "description",
  "make",
  "model",
  "photoUrl",
  "yearFrom",
  "yearTo",
  "warehouse",
];

const FIELD_KEYWORDS: Record<FieldKey, string[]> = {
  productCode: ["код продукт", "код товар", "product code", "артикул", "sku"],
  originCode: ["оригинал", "origin", "oem"],
  price: ["цена", "price", "qiymət", "qiymet"],
  stock: ["кол-во", "количество", "остаток", "шт", "stock", "qty", "quantity", "miqdar"],
  nameRu: ["назв", "наимен", "рус", "name ru", "name (ru)"],
  nameAz: ["adı", "adi", "azərb", "azerb", "азерб", "name az", "name (az)"],
  nameKa: ["დასახელება", "სახელი", "ქარ", "груз", "name ka", "name (ka)"],
  description: ["опис", "descr", "təsvir", "tesvir"],
  make: ["марка", "marka", "make"],
  model: ["модел", "model"],
  photoUrl: ["фото", "photo", "image", "şəkil", "sekil"],
  yearFrom: ["год от", "год с", "year from", "ildən", "ilden"],
  yearTo: ["год до", "год по", "year to", "ilə qədər", "ile qeder"],
  warehouse: ["склад", "магазин", "warehouse", "store", "anbar", "საწყობი"],
};

// Name columns are matched first so a header like "Наименование" is claimed
// as the Russian name rather than by a later field's looser keyword.
const GUESS_ORDER: FieldKey[] = [...NAME_FIELDS, ...FIELD_ORDER];

function guessMapping(headers: string[]): Partial<Record<FieldKey, number>> {
  const lower = headers.map((h) => h.toLowerCase());
  const used = new Set<number>();
  const mapping: Partial<Record<FieldKey, number>> = {};
  for (const field of GUESS_ORDER) {
    const keywords = FIELD_KEYWORDS[field];
    const idx = lower.findIndex((h, i) => !used.has(i) && keywords.some((k) => h.includes(k)));
    if (idx !== -1) {
      mapping[field] = idx;
      used.add(idx);
    }
  }
  // A file with a single, language-neutral "Name"/"Ad" column: treat it as
  // the Russian name — the import fills the other two languages from it.
  if (mapping.nameRu == null) {
    const idx = lower.findIndex(
      (h, i) => !used.has(i) && (h.includes("name") || h.trim() === "ad")
    );
    if (idx !== -1) mapping.nameRu = idx;
  }
  return mapping;
}

export default function ImportProductsModal({
  locale,
  dict,
  brands,
  warehouses,
  onClose,
}: {
  locale: Locale;
  dict: Dictionary["admin"];
  brands: { id: string; name: string }[];
  warehouses: { id: string; name: string }[];
  onClose: () => void;
}) {
  const [headers, setHeaders] = useState<string[] | null>(null);
  const [dataRows, setDataRows] = useState<unknown[][]>([]);
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, number>>>({});
  const [brandId, setBrandId] = useState<string>(brands[0]?.id ?? "");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const inputClass =
    "rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50";
  const labelClass = "text-sm font-medium text-zinc-700 dark:text-zinc-300";

  const fieldLabels: Record<FieldKey, string> = useMemo(
    () => ({
      productCode: dict.importFieldProductCode,
      originCode: dict.importFieldOriginCode,
      price: dict.importFieldPrice,
      stock: dict.importFieldStock,
      nameRu: dict.importFieldNameRu,
      nameAz: dict.importFieldNameAz,
      nameKa: dict.importFieldNameKa,
      description: dict.importFieldDescription,
      make: dict.importFieldMake,
      model: dict.importFieldModel,
      photoUrl: dict.importFieldPhoto,
      yearFrom: dict.importFieldYearFrom,
      yearTo: dict.importFieldYearTo,
      warehouse: dict.importFieldWarehouse,
    }),
    [dict]
  );

  function resetFile() {
    setHeaders(null);
    setDataRows([]);
    setMapping({});
    setResult(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setParseError(null);
    setResult(null);
    try {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows2d = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
      const nonEmpty = rows2d.filter((r) => Array.isArray(r) && r.some((c) => String(c ?? "").trim() !== ""));
      const [headerRow, ...rest] = nonEmpty;
      if (!headerRow || rest.length === 0) {
        setParseError(dict.importParseErrorLabel);
        return;
      }
      const headerStrings = headerRow.map((h, i) => String(h ?? "").trim() || `#${i + 1}`);
      setHeaders(headerStrings);
      setDataRows(rest);
      setMapping(guessMapping(headerStrings));
    } catch {
      setParseError(dict.importParseErrorLabel);
    }
  }

  function handleSubmit() {
    if (mapping.productCode == null || !headers) return;
    const codeIdx = mapping.productCode;

    function cell(row: unknown[], idx: number | undefined): string {
      if (idx == null) return "";
      return String(row[idx] ?? "").trim();
    }
    function cellNumber(row: unknown[], idx: number | undefined): number | undefined {
      const raw = cell(row, idx);
      if (!raw) return undefined;
      const n = Number(raw);
      return Number.isFinite(n) ? n : undefined;
    }

    const importRows: ImportRow[] = dataRows
      .map((row) => ({
        productCode: cell(row, codeIdx),
        originCode: cell(row, mapping.originCode) || undefined,
        price: cellNumber(row, mapping.price),
        stock: cellNumber(row, mapping.stock),
        nameRu: cell(row, mapping.nameRu) || undefined,
        nameAz: cell(row, mapping.nameAz) || undefined,
        nameKa: cell(row, mapping.nameKa) || undefined,
        description: cell(row, mapping.description) || undefined,
        make: cell(row, mapping.make) || undefined,
        model: cell(row, mapping.model) || undefined,
        photoUrl: cell(row, mapping.photoUrl) || undefined,
        yearFrom: cellNumber(row, mapping.yearFrom),
        yearTo: cellNumber(row, mapping.yearTo),
        warehouseName: cell(row, mapping.warehouse) || undefined,
      }))
      .filter((r) => r.productCode);

    startTransition(async () => {
      const res = await importProductsAction(locale, brandId, importRows, warehouseId || undefined);
      setResult(res);
    });
  }

  function renderFieldSelect(field: FieldKey) {
    if (!headers) return null;
    return (
      <div key={field} className="flex flex-col gap-1">
        <label htmlFor={`import-map-${field}`} className="text-xs text-zinc-500">
          {fieldLabels[field]}
        </label>
        <select
          id={`import-map-${field}`}
          value={mapping[field] ?? ""}
          onChange={(e) =>
            setMapping((prev) => ({
              ...prev,
              [field]: e.target.value === "" ? undefined : Number(e.target.value),
            }))
          }
          className={inputClass}
        >
          <option value="">{dict.importNotUsedOption}</option>
          {headers.map((h, i) => (
            <option key={i} value={i}>
              {h}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-16">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />
      <div className="relative flex w-full max-w-3xl flex-col gap-5 rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{dict.importModalTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" className="h-4 w-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {!headers ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="import-file" className={labelClass}>
              {dict.importStepUploadLabel}
            </label>
            <input
              id="import-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFile}
              className="text-sm text-zinc-600 dark:text-zinc-400"
            />
            {parseError && <p className="text-sm text-red-600">{parseError}</p>}
          </div>
        ) : result ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              {dict.importResultDonePrefix} {dict.importResultCreatedLabel} — {result.created},{" "}
              {dict.importResultUpdatedLabel} — {result.updated}, {dict.importResultSkippedLabel} —{" "}
              {result.skipped}.
              {result.warehouseStockSet > 0 && (
                <>
                  {" "}
                  {dict.importWarehouseStockSetLabel} {result.warehouseStockSet}.
                </>
              )}
            </p>
            {result.conflicts > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-500">
                {dict.importConflictsFoundLabel} {result.conflicts}. {dict.importConflictsHint}
              </p>
            )}
            {result.error && <p className="text-sm text-red-600">{result.error}</p>}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={resetFile}
                className="flex-1 rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
              >
                {dict.importBackButton}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500"
              >
                {dict.cancel}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-zinc-400">
              {dict.importRowsDetectedLabel} {dataRows.length}
            </p>

            <div className="flex flex-col gap-1.5">
              <span className={labelClass}>{dict.importMappingTitle}</span>

              {/* The three name columns, set apart in their own row so the
                  language each one feeds is unmistakable. */}
              <div className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                <span className="text-xs font-medium text-zinc-500">{dict.importFieldName}</span>
                <div
                  className="mt-2 grid grid-cols-1 sm:grid-cols-3"
                  style={{ gap: "12px" }}
                >
                  {NAME_FIELDS.map(renderFieldSelect)}
                </div>
              </div>

              <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {FIELD_ORDER.map(renderFieldSelect)}
              </div>
              {mapping.productCode == null && (
                <p className="text-sm text-red-600">{dict.importMissingProductCodeColumn}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="import-brand" className={labelClass}>
                  {dict.productBrandLabel}
                </label>
                <select
                  id="import-brand"
                  value={brandId}
                  onChange={(e) => setBrandId(e.target.value)}
                  className={inputClass}
                >
                  {brands.length === 0 && <option value="">—</option>}
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="import-warehouse" className={labelClass}>
                  {dict.warehousesTitle}
                </label>
                <select
                  id="import-warehouse"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">{dict.importNotUsedOption}</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-zinc-400">{dict.importWarehouseHint}</span>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={resetFile}
                className="flex-1 rounded-full border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-orange-500 hover:text-orange-600 dark:border-zinc-700 dark:text-zinc-300"
              >
                {dict.importBackButton}
              </button>
              <button
                type="button"
                disabled={pending || mapping.productCode == null || !brandId}
                onClick={handleSubmit}
                className="flex-1 rounded-full bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-60"
              >
                {dict.importSubmitButton}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
