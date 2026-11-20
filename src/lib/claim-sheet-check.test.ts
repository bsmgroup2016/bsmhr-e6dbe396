import { describe, expect, it } from "bun:test";
import ExcelJS from "exceljs";
import { applyClaimFixes, checkClaimWorkbook } from "./claim-sheet-check";
import { createClaimWorkbook } from "./combined-claim-export";
import type { ClaimSheet } from "./types";

/** Template like the user's: titles, S/N, code, name, category, days 1–31 (=DATE headers), row totals, footer total. */
async function template(opts: { badSecondSlot?: boolean; partialFooter?: boolean } = {}) {
  const book = new ExcelJS.Workbook();
  const ws = book.addWorksheet("TEMPLATE");
  ["CLIENT", "SITE", "CLAIM FOR"].forEach((v, i) => (ws.getCell(i + 1, 1).value = v));
  ["S/N", "STAFF CODE", "NAME", "CATEGORY"].forEach((v, i) => (ws.getCell(4, i + 1).value = v));
  for (let d = 1; d <= 31; d++) ws.getCell(4, 4 + d).value = { formula: `DATE(2026,1,${d})` } as never;
  for (const [i, g] of [[1, 5], [2, 7]] as const) {
    ws.getCell(g, 1).value = i; ws.getCell(g, 4).value = "G-HRS"; ws.getCell(g + 1, 4).value = "OT HOURS";
    ws.getCell(g, 36).value = { formula: `SUM(E${g}:AI${g})` } as never;
    ws.getCell(g + 1, 36).value = { formula: `SUM(E${g + 1}:AI${g + 1})` } as never;
  }
  if (opts.badSecondSlot) ws.getCell(7, 36).value = { formula: "SUM(E7:AH7)" } as never; // misses day 31
  ws.getCell(10, 35).value = "TOTAL";
  ws.getCell(10, 36).value = { formula: opts.partialFooter ? "SUM(AJ5:AJ6)" : "SUM(AJ5:AJ8)" } as never;
  return (await book.xlsx.writeBuffer()) as ArrayBuffer;
}

const claims = (n: number): ClaimSheet[] => Array.from({ length: n }, (_, i) => ({
  id: `c${i}`, reference: `c${i}`, periodStart: "2026-02-01", periodEnd: "2026-02-28", totalDays: 2, totalNormalHours: 16, totalOtHours: 2,
  snapshot: [2, 3].map((d) => ({ date: `2026-02-0${d}`, employeeCode: `PC-${i + 1}`, workerName: `WORKER ${i + 1}`, site: "ITTC C-190", normalHours: 8, otHours: 1, status: "Present" })),
}));
const input = (n: number) => ({ sheets: claims(n), employees: [], month: "2026-02", site: "ITTC C-190", knownSites: ["ITTC C-190"] });

describe("claim sheet check", () => {
  it("passes a correct workbook with extra workers added", async () => {
    const wb = await createClaimWorkbook(claims(4), [], [], "2026-02", { templateBuffer: await template(), clientName: "GS Engineering" });
    expect(wb.worksheets[0]!.getCell("A1").value).toBe("GS ENGINEERING"); // typed client fills the title
    const r = checkClaimWorkbook(wb, input(4));
    expect(r.issues).toEqual([]);
    expect(r.passed).toHaveLength(6);
  });

  it("finds a worker row whose formula differs, including the rows copied from it, and fixes them", async () => {
    const wb = await createClaimWorkbook(claims(4), [], [], "2026-02", { templateBuffer: await template({ badSecondSlot: true }) });
    const r = checkClaimWorkbook(wb, input(4));
    const bad = r.issues.filter((i) => /Formula differs/.test(i.message)).map((i) => i.cell);
    expect(bad).toEqual(["AJ7", "AJ9", "AJ11"]); // the template's 2nd row and both rows copied from it
    expect(applyClaimFixes(wb, r.issues)).toBe(3);
    expect(wb.worksheets[0]!.getCell("AJ11").formula).toBe("SUM(E11:AI11)");
    expect(checkClaimWorkbook(wb, input(4)).issues.filter((i) => /Formula/.test(i.message))).toEqual([]);
  });

  it("warns about a total that stops before the last worker, without changing it", async () => {
    const wb = await createClaimWorkbook(claims(2), [], [], "2026-02", { templateBuffer: await template({ partialFooter: true }) });
    const r = checkClaimWorkbook(wb, input(2));
    const total = r.issues.find((i) => /stops at row 6/.test(i.message))!;
    expect(total).toMatchObject({ level: "warning", cell: "AJ10" });
    expect(total.fix).toBeUndefined();
  });

  it("moves typed date headers and the weekday row to the claim month (template made for Oct)", async () => {
    const book = new ExcelJS.Workbook();
    const ws = book.addWorksheet("PENTA OCEAN");
    ["S/n", "Co.", "Staff Code", "Staff Name", "Category"].forEach((v, i) => (ws.getCell(4, i + 1).value = v));
    for (let d = 1; d <= 31; d++) {
      ws.getCell(4, 5 + d).value = new Date(Date.UTC(2026, 9, d));
      ws.getCell(5, 5 + d).value = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(Date.UTC(2026, 9, d)).getUTCDay()];
    }
    ws.getCell(1, 1).value = "Client Name"; ws.getCell(2, 1).value = "Site Name"; ws.getCell(3, 1).value = "CLAIM SUMMARY FOR OCT 2026";
    ws.getCell(6, 1).value = 1; ws.getCell(6, 5).value = "G-Hrs"; ws.getCell(7, 5).value = "OT Hrs";
    const out = await createClaimWorkbook(claims(1), [], [], "2026-02", { templateBuffer: (await book.xlsx.writeBuffer()) as ArrayBuffer });
    const page = out.worksheets[0]!;
    expect((page.getCell(4, 6).value as Date).toISOString().slice(0, 10)).toBe("2026-02-01");
    expect(page.getCell(5, 6).value).toBe("Sun"); // 1 Feb 2026 is a Sunday (1 Oct was a Thursday)
    expect(page.getCell(4, 34).value).toBeNull(); // no 29 Feb
    expect(page.getCell(5, 36).value).toBeNull();
    expect(checkClaimWorkbook(out, { ...input(1), knownSites: undefined }).issues.filter((i) => /header|Weekday/.test(i.message))).toEqual([]);
    // The check itself catches a sheet that still carries October's dates and weekdays.
    page.getCell(4, 6).value = new Date(Date.UTC(2026, 9, 1)); page.getCell(5, 6).value = "Thu";
    const found = checkClaimWorkbook(out, input(1)).issues.filter((i) => /header shows|Weekday under/.test(i.message));
    expect(found.map((i) => i.cell)).toEqual(["F4", "F5"]);
    applyClaimFixes(out, found);
    expect(page.getCell("F5").value).toBe("Sun");
  });

  it("flags an unknown site, a wrong title month and wrong hours", async () => {
    const wb = await createClaimWorkbook(claims(2), [], [], "2026-02", { templateBuffer: await template() });
    const ws = wb.worksheets[0]!;
    ws.getCell("A3").value = "CLAIM FOR JAN 2026";
    ws.getCell("F5").value = 9; // day 2 for PC-1 should be 8
    const r = checkClaimWorkbook(wb, { ...input(2), knownSites: ["JURONG EAST"] });
    expect(r.issues.some((i) => i.cell === "A2" && /not in Projects & Sites/.test(i.message))).toBe(true);
    expect(r.issues.find((i) => i.cell === "A3")?.fix?.value).toBe("CLAIM FOR FEB 2026");
    expect(r.issues.some((i) => /PC-1 2026-02-02: Hours differ/.test(i.message))).toBe(true);
  });
});
