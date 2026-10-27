import { describe, expect, it } from "vitest";
import { mergeDuplicateImportRows, type ImportRow } from "./importRows";

describe("mergeDuplicateImportRows", () => {
  it("passes distinct codes through unchanged, trimming the code", () => {
    const rows: ImportRow[] = [{ productCode: " A1 ", price: 10 }, { productCode: "B2", price: 20 }];
    expect(mergeDuplicateImportRows(rows)).toEqual({
      rows: [
        { productCode: "A1", price: 10 },
        { productCode: "B2", price: 20 },
      ],
      conflicts: [],
    });
  });

  it("merges repeats of one code case-insensitively, keeping the first spelling", () => {
    const { rows } = mergeDuplicateImportRows([
      { productCode: "21202ap", nameRu: "Рычаг" },
      { productCode: "21202Ap", nameAz: "Qol" },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ productCode: "21202ap", nameRu: "Рычаг", nameAz: "Qol" });
  });

  it("takes the first non-empty value of each field across the repeats", () => {
    const { rows } = mergeDuplicateImportRows([
      { productCode: "A1", stock: 5, make: "BMW" },
      { productCode: "A1", stock: 9, make: "AUDI", model: "X5", years: "2010-2015" },
    ]);
    expect(rows[0]).toMatchObject({ stock: 5, make: "BMW", model: "X5", years: "2010-2015" });
  });

  it("fills a missing price from a repeat without calling it a conflict", () => {
    const result = mergeDuplicateImportRows([{ productCode: "A1" }, { productCode: "A1", price: 12 }]);
    expect(result.rows[0].price).toBe(12);
    expect(result.conflicts).toEqual([]);
  });

  it("keeps the higher price and reports the disagreement", () => {
    const result = mergeDuplicateImportRows([
      { productCode: "A1", price: 10, originCode: "OEM1/OEM2" },
      { productCode: "a1", price: 15 },
    ]);
    expect(result.rows[0].price).toBe(15);
    expect(result.conflicts).toEqual([
      { productCode: "a1", originCode: "OEM1", field: "price", values: ["10", "15"], resolvedValue: "15" },
    ]);
  });

  it("does not report equal prices as a conflict", () => {
    expect(
      mergeDuplicateImportRows([
        { productCode: "A1", price: 10 },
        { productCode: "A1", price: 10 },
      ]).conflicts
    ).toEqual([]);
  });

  it("collects every OEM code from the repeats, first one staying first", () => {
    const { rows } = mergeDuplicateImportRows([
      { productCode: "A1", originCode: "111 / 222" },
      { productCode: "A1", originCode: "222/333" },
    ]);
    expect(rows[0].originCode).toBe("111/222/333");
  });
});
