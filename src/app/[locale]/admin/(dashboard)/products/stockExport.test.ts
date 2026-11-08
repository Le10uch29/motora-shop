import { describe, expect, it } from "vitest";
import {
  buildStockCsv,
  csvCell,
  csvCodeCell,
  orderForExport,
  parseScope,
  resolveColumns,
  STOCK_EXPORT_COLUMNS,
  type StockExportColumn,
  type StockExportProduct,
} from "./stockExport";

const product = (over: Partial<StockExportProduct> = {}): StockExportProduct => ({
  productCode: "BLT-08",
  originCode: "11-22",
  name: "Болт",
  brand: "Erling",
  make: "BMW",
  model: "G30",
  years: "2017-2020",
  stock: 10,
  price: 12.5,
  oldPrice: null,
  photo: "https://cdn.example/a.webp",
  ...over,
});

const labels = Object.fromEntries(STOCK_EXPORT_COLUMNS.map((c) => [c, c])) as Record<StockExportColumn, string>;
const status = { inStock: "Есть", outOfStock: "Нет" };

describe("resolveColumns", () => {
  it("always keeps the required columns and orders them like the file", () => {
    expect(resolveColumns([])).toEqual(["productCode", "name", "stock", "price"]);
    expect(resolveColumns(["photo", "brand", "bogus"])).toEqual([
      "productCode",
      "name",
      "brand",
      "stock",
      "price",
      "photo",
    ]);
  });
});

describe("parseScope", () => {
  it("falls back to all", () => {
    expect(parseScope("out_of_stock")).toBe("out_of_stock");
    expect(parseScope("x")).toBe("all");
    expect(parseScope(undefined)).toBe("all");
  });
});

describe("orderForExport", () => {
  it("puts products in stock first (largest first), then the sold-out ones by name", () => {
    const rows = [
      product({ productCode: "A", name: "Я", stock: 0 }),
      product({ productCode: "B", stock: 5 }),
      product({ productCode: "C", name: "А", stock: -2 }),
      product({ productCode: "D", stock: 50 }),
    ];
    expect(orderForExport(rows).map((r) => r.productCode)).toEqual(["D", "B", "C", "A"]);
  });
});

describe("csvCell", () => {
  it("quotes separators, quotes and line breaks", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell('6" диск')).toBe('"6"" диск"');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });

  it("writes decimals with a comma and leaves empty values empty", () => {
    expect(csvCell(12.5)).toBe("12,5");
    expect(csvCell(null)).toBe("");
  });

  it("defuses text Excel would run as a formula", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-abc")).toBe("'-abc");
    expect(csvCell(-3)).toBe("-3");
  });
});

describe("csvCodeCell", () => {
  it("keeps number- and date-like codes as text for Excel", () => {
    expect(csvCodeCell("403.730")).toBe('"=""403.730"""');
    expect(csvCodeCell("12-05")).toBe('"=""12-05"""');
    expect(csvCodeCell("BLT-08")).toBe("BLT-08");
    expect(csvCodeCell("")).toBe("");
  });
});

describe("buildStockCsv", () => {
  it("writes a BOM, the headers and one line per product", () => {
    const csv = buildStockCsv(
      [product({ stock: 0, productCode: "Z" }), product()],
      ["productCode", "name", "stock", "status", "price"],
      labels,
      status
    );
    expect(csv).toBe(
      "﻿productCode;name;stock;status;price\r\n" +
        "BLT-08;Болт;10;Есть;12,5\r\n" +
        "Z;Болт;0;Нет;12,5\r\n"
    );
  });

  it("never prints a negative stock", () => {
    const csv = buildStockCsv([product({ stock: -4 })], ["productCode", "stock"], labels, status);
    expect(csv.split("\r\n")[1]).toBe("BLT-08;0");
  });
});
