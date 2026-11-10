import { describe, expect, it } from "vitest";
import { keptQuantity, withoutReturned } from "./orderReturns";

describe("withoutReturned", () => {
  const rows = [
    { id: "a", quantity: 5, price: 10 },
    { id: "b", quantity: 2, price: 3 },
    { id: "c", quantity: 1, price: 7 },
  ];

  it("subtracts what was returned and drops lines returned in full", () => {
    const returned = new Map([
      ["a", 2],
      ["b", 2],
    ]);
    expect(withoutReturned(rows, returned)).toEqual([
      { id: "a", quantity: 3, price: 10 },
      { id: "c", quantity: 1, price: 7 },
    ]);
  });

  it("leaves rows as they are when nothing was returned", () => {
    expect(withoutReturned(rows, new Map())).toBe(rows);
  });

  it("never goes below zero", () => {
    expect(keptQuantity("a", 2, new Map([["a", 5]]))).toBe(0);
  });
});
