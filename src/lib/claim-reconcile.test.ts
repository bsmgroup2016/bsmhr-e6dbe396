import { test, expect } from "bun:test";
import ExcelJS from "exceljs";
import { reconcileClaimWorkbook } from "./combined-claim-export";
import type { ClaimSheet } from "./types";

function book(g: number, ot: number) {
  const b = new ExcelJS.Workbook(); const p = b.addWorksheet("TEMPLATE");
  ["STAFF CODE", "NAME", "CATEGORY"].forEach((t, i) => (p.getCell(4, 2 + i).value = t));
  p.getCell(4, 5).value = 1; p.getCell(4, 6).value = 2;
  p.getCell(5, 4).value = "G-HRS"; p.getCell(6, 4).value = "OT HOURS";
  p.getCell(5, 2).value = "PC-34"; p.getCell(5, 3).value = "RAKIBUL";
  p.getCell(5, 5).value = g; p.getCell(6, 5).value = ot;
  return b;
}
const sheet = (dates: [string, number, number][]) => [{ id: "s", periodStart: "2026-10-01", periodEnd: "2026-10-31",
  snapshot: dates.map(([date, normalHours, otHours]) => ({ date, normalHours, otHours, employeeCode: "PC-34", workerName: "RAKIBUL" })) }] as unknown as ClaimSheet[];

test("matching sheet reports no mismatches", () => {
  expect(reconcileClaimWorkbook(book(8, 3.5), sheet([["2026-10-01", 8, 3.5]]), [], "2026-10")).toEqual([]);
});
test("different OT hours are reported", () => {
  expect(reconcileClaimWorkbook(book(8, 3), sheet([["2026-10-01", 8, 3.5]]), [], "2026-10")[0].kind).toBe("Hours differ");
});
test("a worked Sunday missing from the sheet is reported", () => {
  const issues = reconcileClaimWorkbook(book(8, 0), sheet([["2026-10-01", 8, 0], ["2026-10-02", 8, 2]]), [], "2026-10");
  expect(issues.map(i => [i.date, i.kind])).toEqual([["2026-10-02", "Missing in sheet"]]);
});
