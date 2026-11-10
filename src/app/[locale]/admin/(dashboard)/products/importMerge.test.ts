import { describe, expect, it } from "vitest";
import { applyDecision, decisionForAll, describeChanges, mergeWarehouseQuantity } from "./importMerge";
import type { ExistingProductRow, PlannedUpdate } from "./importSteps";

const existing: ExistingProductRow = {
  id: "p1",
  product_code: "A1",
  price: 10,
  stock: 5,
  origin_code: "OEM-1",
  make: "BMW",
  model: "G30",
  fitments: null,
  brand_id: "b1",
  images: ["https://cdn/old.webp"],
  name: { ru: "Старое", az: "Köhnə", ka: "ძველი" },
  description: null,
  year_from: 2017,
  year_to: 2020,
};

const update: PlannedUpdate = {
  id: "p1",
  code: "A1",
  patch: {
    price: 12,
    stock: 8,
    images: ["https://cdn/new.webp", "https://cdn/old.webp"],
    name: { ru: "Новое", az: "Yeni", ka: "ახალი" },
  },
  previous: { price: 10, stock: 5, images: ["https://cdn/old.webp"], name: existing.name },
};

describe("describeChanges", () => {
  it("lists each differing field with the current and the file value", () => {
    expect(describeChanges(update, existing)).toEqual([
      { field: "price", current: "10", next: "12" },
      { field: "stock", current: "5", next: "8" },
      { field: "photo", current: "https://cdn/old.webp", next: "https://cdn/new.webp" },
      { field: "name", current: "Старое", next: "Новое" },
    ]);
  });
});

describe("applyDecision", () => {
  it("replaces only the chosen fields and replaces the stock", () => {
    const result = applyDecision(update, existing, 8, { fields: ["price"], stockMode: "replace" });
    expect(result?.patch).toEqual({ price: 12, stock: 8 });
    expect(result?.previous).toEqual({ price: 10, stock: 5 });
  });

  it("adds the file quantity to the current stock", () => {
    const result = applyDecision(update, existing, 8, { fields: [], stockMode: "add" });
    expect(result?.patch).toEqual({ stock: 13 });
    expect(result?.previous).toEqual({ stock: 5 });
  });

  it("adds even when the file quantity equals the current one", () => {
    expect(applyDecision(update, existing, 5, { fields: [], stockMode: "add" })?.patch).toEqual({ stock: 10 });
  });

  it("leaves the stock alone when skipped and returns null when nothing is left", () => {
    expect(applyDecision(update, existing, 8, { fields: [], stockMode: "skip" })).toBeNull();
    expect(applyDecision(update, existing, 8, { fields: ["name"], stockMode: "skip" })?.patch).toEqual({
      name: update.patch.name,
    });
  });

  it("does nothing with the stock when the file has no quantity", () => {
    expect(applyDecision(update, existing, undefined, { fields: [], stockMode: "add" })).toBeNull();
  });
});

describe("mergeWarehouseQuantity", () => {
  it("replaces, adds or skips", () => {
    expect(mergeWarehouseQuantity(5, 8, "replace")).toBe(8);
    expect(mergeWarehouseQuantity(8, 8, "replace")).toBeNull();
    expect(mergeWarehouseQuantity(5, 8, "add")).toBe(13);
    expect(mergeWarehouseQuantity(null, 8, "add")).toBe(8);
    expect(mergeWarehouseQuantity(5, 8, "skip")).toBeNull();
  });
});

describe("decisionForAll", () => {
  it("replaces every field and uses the chosen stock mode", () => {
    const [decision] = decisionForAll(
      [{ productId: "p1", code: "A1", name: "x", image: null, currentStock: 5, fileStock: 8, changes: [] }],
      "add"
    );
    expect(decision.stockMode).toBe("add");
    expect(decision.fields).not.toContain("stock");
    expect(decision.fields).toContain("price");
  });
});
