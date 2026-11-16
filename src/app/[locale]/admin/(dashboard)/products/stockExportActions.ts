"use server";

import sharp from "sharp";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readAllPages } from "@/lib/supabase/paginate";
import { getDictionary } from "@/i18n/getDictionary";
import type { Locale } from "@/i18n/locales";
import { fitmentsOf, fitmentsToFields, UNIVERSAL_MAKE, type Fitment } from "@/lib/fitments";
import type { LocalizedText } from "@/lib/products";
import { LOW_STOCK_THRESHOLD } from "@/lib/adminConfig";
import type { XlsxCell, XlsxColumn } from "@/lib/xlsxWriter";
import {
  buildStockTable,
  parseScope,
  resolveColumns,
  type StockExportColumn,
  type StockExportProduct,
} from "./stockExport";

type ExportRow = {
  id: string;
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
 * Остатки товаров таблицей для Excel. Только читает — в базе ничего не
 * меняется. Только для админа.
 *
 * Сам .xlsx собирает браузер (lib/xlsxWriter): с фото файл бывает в десятки
 * мегабайт, а ответ сервера на Vercel ограничен ~4.5 МБ. Поэтому отсюда уходят
 * только строки, а фото — отдельно и пачками (getStockExportPhotosAction).
 */
export async function exportStockAction(
  locale: Locale,
  input: { columns: string[]; scope: string; brandId: string | null }
): Promise<
  | {
      ok: true;
      columns: XlsxColumn[];
      rows: XlsxCell[][];
      photoIds: (string | null)[];
      photoCol: number;
      filename: string;
      sheetName: string;
      count: number;
    }
  | { ok: false; error: string }
> {
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
          "id, product_code, origin_code, name, price, old_price, stock, images, fitments, make, model, year_from, year_to, brands(name)"
        );
      if (brandId) query = query.eq("brand_id", brandId);
      if (scope === "in_stock") query = query.gt("stock", 0);
      if (scope === "low_stock") query = query.gt("stock", 0).lt("stock", LOW_STOCK_THRESHOLD);
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
      id: p.id,
      productCode: p.product_code ?? "",
      originCode: p.origin_code ?? "",
      name: p.name?.[locale] || p.name?.ru || p.name?.az || p.name?.ka || "",
      brand: brand?.name ?? "",
      make: vehicle.make === UNIVERSAL_MAKE ? "" : vehicle.make,
      model: vehicle.model,
      years: vehicle.years,
      stock: p.stock ?? 0,
      price: Number(p.price ?? 0),
      oldPrice: p.old_price != null ? Number(p.old_price) : null,
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

  const table = buildStockTable(products, columns, labels, {
    inStock: dict.stockExportInStock,
    outOfStock: dict.stockExportOutOfStock,
  });
  const date = new Date().toISOString().slice(0, 10);
  return {
    ok: true,
    ...table,
    filename: `ostatki-${date}.xlsx`,
    sheetName: dict.stockExportSheetName,
    count: products.length,
  };
}

/** Сколько фото отдаётся за один вызов: ~20 × 8 КБ — далеко от лимита ответа. */
const PHOTO_BATCH = 20;
/** Сторона уменьшенного фото, px: в файле оно ~72px, вдвое — для чёткости. */
const PHOTO_SIZE = 144;
const PHOTO_TIMEOUT_MS = 10_000;
const PHOTO_MAX_BYTES = 15 * 1024 * 1024;

export type StockExportPhoto = { id: string; jpeg: string; width: number; height: number };

/**
 * Первые фото товаров — уменьшенными JPEG (base64) для вставки в .xlsx.
 *
 * Сервер сам скачивает фото по адресу из карточки товара: браузеру чужие
 * адреса картинок часто закрыты (CORS), а Excel принимает только JPEG/PNG, не
 * WebP, в котором хранятся фото магазина. Адреса берутся из базы по id, а не
 * из запроса, — скачать отсюда произвольную ссылку нельзя.
 *
 * Фото, которое не скачалось, просто пропускается: в файле ячейка останется
 * пустой, а не сорвёт весь экспорт.
 */
export async function getStockExportPhotosAction(
  locale: Locale,
  productIds: string[]
): Promise<StockExportPhoto[]> {
  await requireAdmin(locale);
  const ids = (Array.isArray(productIds) ? productIds : []).filter((id) => UUID.test(id)).slice(0, PHOTO_BATCH);
  if (ids.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("id, images").in("id", ids);
  if (error || !data) return [];

  const photos = await Promise.all(
    (data as { id: string; images: string[] | null }[]).map(async (row) => {
      const url = row.images?.find((value) => value?.trim())?.trim();
      if (!url || !/^https?:\/\//i.test(url)) return null;
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(PHOTO_TIMEOUT_MS) });
        if (!response.ok) return null;
        const size = Number(response.headers.get("content-length") ?? 0);
        if (size > PHOTO_MAX_BYTES) return null;
        const input = Buffer.from(await response.arrayBuffer());
        if (input.length > PHOTO_MAX_BYTES) return null;
        const { data: jpeg, info } = await sharp(input, { failOn: "none" })
          .rotate()
          .flatten({ background: "#ffffff" })
          .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 75 })
          .toBuffer({ resolveWithObject: true });
        return { id: row.id, jpeg: jpeg.toString("base64"), width: info.width, height: info.height };
      } catch {
        return null;
      }
    })
  );
  return photos.filter((photo): photo is StockExportPhoto => photo !== null);
}
