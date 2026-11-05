import { describe, expect, it } from "vitest";
import { planImportRows, readAllRows, type ExistingProductRow, type ImportContext } from "./importSteps";

const BRAND = "brand-aplus";

function existing(overrides: Partial<ExistingProductRow> = {}): ExistingProductRow {
  return {
    id: "p1",
    product_code: "21202AP",
    price: 10,
    stock: 5,
    origin_code: "OEM1",
    make: "BMW",
    model: "X5",
    fitments: [{ make: "BMW", model: "X5", yearFrom: 2010, yearTo: 2015 }],
    brand_id: BRAND,
    images: ["https://cdn/a.webp"],
    name: { ru: "Рычаг", az: "Qol", ka: "ბერკეტი" },
    description: { ru: "", az: "", ka: "" },
    year_from: 2010,
    year_to: 2015,
    ...overrides,
  };
}

function context(rows: ExistingProductRow[]): ImportContext {
  return {
    existingByCode: new Map(rows.map((row) => [row.product_code!.toLowerCase(), row])),
    uniqueSlug: (base) => base,
    resolveWarehouseId: () => null,
  };
}

describe("planImportRows", () => {
  it("updates the existing product with the same code instead of creating a new one", () => {
    const plan = planImportRows([{ productCode: "21202ap", price: 12 }], context([existing()]), BRAND);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(1);
  });

  it("overwrites a selected, filled field when the file differs", () => {
    const plan = planImportRows([{ productCode: "21202AP", price: 12, stock: 9 }], context([existing()]), BRAND);
    expect(plan.toUpdate[0].patch).toEqual({ price: 12, stock: 9 });
    expect(plan.toUpdate[0].previous).toEqual({ price: 10, stock: 5 });
  });

  it("replaces OEM codes with the ones from the file", () => {
    const plan = planImportRows(
      [{ productCode: "21202AP", originCode: "OEM9 / OEM1" }],
      context([existing({ origin_code: "OEM1/OEM2" })]),
      BRAND
    );
    expect(plan.toUpdate[0].patch).toEqual({ origin_code: "OEM9/OEM1" });
    expect(plan.toUpdate[0].previous).toEqual({ origin_code: "OEM1/OEM2" });
  });

  it("keeps OEM codes when the file has none", () => {
    const plan = planImportRows([{ productCode: "21202AP", originCode: "" }], context([existing()]), BRAND);
    expect(plan.toUpdate).toHaveLength(0);
  });

  it("leaves fields that are not used (absent) untouched", () => {
    const plan = planImportRows([{ productCode: "21202AP" }], context([existing()]), BRAND);
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.unchanged).toBe(1);
  });

  it("changes nothing when the same file is imported again", () => {
    const row = {
      productCode: "21202AP",
      price: 10,
      stock: 5,
      make: "BMW",
      model: "X5",
      years: "2010-2015",
      photoUrl: "https://cdn/a.webp",
      nameRu: "Рычаг",
    };
    const plan = planImportRows([row], context([existing()]), BRAND);
    expect(plan.toInsert).toHaveLength(0);
    expect(plan.toUpdate).toHaveLength(0);
  });

  it("puts a new photo link first and keeps the other photos", () => {
    const plan = planImportRows(
      [{ productCode: "21202AP", photoUrl: "https://cdn/b.webp" }],
      context([existing()]),
      BRAND
    );
    expect(plan.toUpdate[0].patch.images).toEqual(["https://cdn/b.webp", "https://cdn/a.webp"]);
  });

  it("creates a product only when the brand has no product with that code", () => {
    const plan = planImportRows([{ productCode: "NEW-1", price: 5 }], context([existing()]), BRAND);
    expect(plan.toInsert).toHaveLength(1);
  });
});

describe("readAllRows", () => {
  it("reads past the 1000-row page limit", async () => {
    const total = 2013;
    const result = await readAllRows<number>(async (from, to) => ({
      data: Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => from + i),
      error: null,
    }));
    expect(result.rows).toHaveLength(total);
    expect(result.error).toBeNull();
  });

  it("returns the error of a failed page", async () => {
    const result = await readAllRows<number>(async () => ({ data: null, error: { message: "boom" } }));
    expect(result.error).toBe("boom");
  });
});
