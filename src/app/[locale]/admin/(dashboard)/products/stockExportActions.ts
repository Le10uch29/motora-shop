"use server";

import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readAllPages } from "@/lib/supabase/paginate";
import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/locales";
import { fitmentsOf, fitmentsToFields, UNIVERSAL_MAKE, type Fitment } from "@/lib/fitments";
import type { LocalizedText } from "@/lib/products";
import {
  buildStockCsv,
  parseScope,
  resolveColumns,
  type StockExportColumn,
  type StockExportProduct,
} from "./stockExport";

type ExportRow = {
  product_code: string | null;
  origin_code: string | null;
  name: LocalizedText | null;
  price: number;
  old_price: number | null;
  stock: number;
  images: string[] | null;
  fitments: Fitment[] | null;
  make: string;
  model: string | null;
  year_from: number;
  year_to: number;
  brands: { name: string } | { name: string }[] | null;
};

const UUID = /^[0-9a-f-]{36}$/i;

/**
 * Остатки товаров одним CSV-файлом для Excel. Только читает — в базе ничего
 * не меняется. Только для админа.
 *
 * Возвращает текст файла: браузер сам сохраняет его как .csv, отдельный
 * адрес для скачивания не нужен.
 */
export async function exportStockCsvAction(
  locale: Locale,
  input: { columns: string[]; scope: string; brandId: string | null }
): Promise<{ ok: true; csv: string; filename: string; count: number } | { ok: false; error: string }> {
  await requireAdmin(locale);
  const dict = (await getDictionary(locale)).admin;

  const columns = resolveColumns(Array.isArray(input.columns) ? input.columns : []);
  const scope = parseScope(input.scope);
  const brandId = input.brandId && UUID.test(input.brandId) ? input.brandId : null;

  const supabase = await createClient();
  let rows: ExportRow[];
  try {
    rows = await readAllPages<ExportRow>((from, to) => {
      let query = supabase
        .from("products")
        .select(
          "product_code, origin_code, name, price, old_price, stock, images, fitments, make, model, year_from, year_to, brands(name)"
        );
      if (brandId) query = query.eq("brand_id", brandId);
      if (scope === "in_stock") query = query.gt("stock", 0);
      if (scope === "out_of_stock") query = query.lte("stock", 0);
      // Порядок нужен только для постраничного чтения без пропусков —
      // итоговый порядок строк задаёт orderForExport.
      return query.order("id").range(from, to) as unknown as PromiseLike<{ data: ExportRow[] | null }>;
    });
  } catch (error) {
    console.error("[stock-export] read failed:", error);
    return { ok: false, error: dict.stockExportError };
  }

  const products: StockExportProduct[] = rows.map((p) => {
    const brand = Array.isArray(p.brands) ? p.brands[0] : p.brands;
    const vehicle = fitmentsToFields(
      fitmentsOf({ ...p, yearFrom: p.year_from, yearTo: p.year_to }).filter(
        (f) => f.make !== UNIVERSAL_MAKE || f.model
      )
    );
    return {
      productCode: p.product_code ?? "",
      originCode: p.origin_code ?? "",
      name: p.name?.[locale] || p.name?.ru || p.name?.az || p.name?.ka || "",
      brand: brand?.name ?? "",
      make: vehicle.make === UNIVERSAL_MAKE ? "" : vehicle.make,
      model: vehicle.model,
      years: vehicle.years,
      stock: p.stock ?? 0,
      price: p.price ?? 0,
      oldPrice: p.old_price,
      photo: p.images?.find((url) => url?.trim()) ?? "",
    };
  });

  const labels: Record<StockExportColumn, string> = {
    productCode: dict.productsColProductCode,
    originCode: dict.productsColOriginCode,
    name: dict.productsColName,
    brand: dict.productsColBrand,
    make: dict.stockExportColMake,
    model: dict.stockExportColModel,
    years: dict.stockExportColYears,
    stock: dict.productsColStock,
    status: dict.stockExportColStatus,
    price: dict.productsColPrice,
    oldPrice: dict.stockExportColOldPrice,
    photo: dict.stockExportColPhoto,
  };

  const csv = buildStockCsv(products, columns, labels, {
    inStock: dict.stockExportInStock,
    outOfStock: dict.stockExportOutOfStock,
  });
  const date = new Date().toISOString().slice(0, 10);
  return { ok: true, csv, filename: `ostatki-${date}.csv`, count: products.length };
}
