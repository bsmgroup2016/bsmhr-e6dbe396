import { describe, expect, it } from "bun:test";
import { createEvaluator } from "./claim-formula-eval";

const sheet = (cells: Record<string, unknown>) => {
  const letters = (c: number) => { let s = ""; while (c) { s = String.fromCharCode(65 + ((c - 1) % 26)) + s; c = Math.floor((c - 1) / 26); } return s; };
  return createEvaluator((r, c) => {
    const v = cells[`${letters(c)}${r}`];
    return typeof v === "string" && v.startsWith("=") ? { formula: v.slice(1), value: null } : { value: v ?? null };
  });
};

describe("claim preview formulas", () => {
  it("adds G-HRS and OT rows like the template", () => {
    const ev = sheet({ E5: 8, F5: 8, E6: 3.5, AJ5: "=SUM(E5:AI5)", AJ6: "=SUM(E6:AI6)", AK5: "=AJ5+AJ6", AL5: 10, AM5: "=AK5*AL5", AN5: "=COUNT(E5:AI5)" });
    expect(ev.cellValue(5, 36)).toBe(16);
    expect(ev.cellValue(5, 37)).toBe(19.5);
    expect(ev.cellValue(5, 39)).toBe(195);
    expect(ev.cellValue(5, 40)).toBe(2);
  });
  it("reports circular and unsupported formulas instead of a number", () => {
    expect(sheet({ A1: "=A1+1" }).cellValue(1, 1)).toBe("#CIRC");
    expect(sheet({ A1: "=VLOOKUP(1,B1:C2,2)" }).cellValue(1, 1)).toBe("#NAME?");
    expect(sheet({ A1: "=B1/0", B1: 4 }).cellValue(1, 1)).toBe("#DIV/0!");
  });
});
