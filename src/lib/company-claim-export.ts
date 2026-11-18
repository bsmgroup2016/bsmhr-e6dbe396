/**
 * One Excel per company: a COMBINED summary sheet first, then the company's claim sheet
 * for every project/site (filled from the saved blank template, rows grow as needed).
 */
import type { Worksheet } from "exceljs";
import type { CompanyClaimSummary } from "@/core/company-claim-summary";
import { claimWorkbookBlob, createClaimWorkbook, downloadClaimBlob, groupClaimsByProject, type ClaimLookups } from "@/lib/combined-claim-export";
import type { Company, Employee } from "@/lib/types";

const BASIC_HOURS_PER_DAY = 8;
const GST_RATE = 0.09;
const HEAD_FILL = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } } as const;
const THIN = { style: "thin", color: { argb: "FF808080" } } as const;
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };

const monthLabel = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-SG", { month: "short", year: "numeric", timeZone: "UTC" }).toUpperCase();
};
const col = (n: number) => { let s = ""; for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s; return s; };

function headerCell(ws: Worksheet, r: number, c: number, text: string) {
  const cell = ws.getCell(r, c);
  cell.value = text;
  cell.font = { bold: true };
  cell.fill = HEAD_FILL;
  cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  cell.border = BOX;
}

/** Worker × project table, then a project/site billing table — formulas stay live so the sheet can be edited. */
export function writeCombinedSheet(ws: Worksheet, summary: CompanyClaimSummary, month: string) {
  const slots = Math.max(1, ...summary.workers.map((w) => w.projects.length));
  const first = 4; // first project column (after S/N, P-FILE, NAME)
  const after = first + slots * 4; // TOTAL BASIC HOURS column
  const [basic, ot, claim, days, bDays, sun, remark, actualOt, mrt, deduction] = Array.from({ length: 10 }, (_, i) => after + i);
  const last = deduction;

  ws.mergeCells(1, 1, 1, last);
  const title = ws.getCell(1, 1);
  title.value = `${summary.companyName.toUpperCase()} WORKER PROJECT WISE SUMMARY - ${monthLabel(month)}`;
  title.font = { bold: true, size: 14 };
  title.alignment = { horizontal: "center" };

  for (const [c, text] of [[1, "S/N"], [2, "P-FILE NUMBER"], [3, "NAME"]] as const) { ws.mergeCells(2, c, 3, c); headerCell(ws, 2, c, text); }
  for (let k = 0; k < slots; k++) {
    const c = first + k * 4;
    ws.mergeCells(2, c, 2, c + 3);
    headerCell(ws, 2, c, `PROJECT ${k + 1}`);
    ["PROJECT / SITE", "B DAY", "SUNDAY", "CLAIM SHEET OT"].forEach((t, i) => headerCell(ws, 3, c + i, t));
  }
  const tail: [number, string][] = [[basic, "TOTAL BASIC HOURS"], [ot, "OT HOUR"], [claim, "T/CLAIM HOURS"], [days, "TOTAL DAYS"], [bDays, "B.DAYS"], [sun, "SUNDAY"], [remark, "REMARK"], [actualOt, "ACTUAL OT"], [mrt, "MRT / BUS"], [deduction, "DEDUCTION"]];
  for (const [c, text] of tail) { ws.mergeCells(2, c, 3, c); headerCell(ws, 2, c, text); }

  const slotCols = (offset: number, r: number) => Array.from({ length: slots }, (_, k) => `${col(first + k * 4 + offset)}${r}`).join(",");
  let r = 4;
  summary.workers.forEach((w, i) => {
    ws.getCell(r, 1).value = i + 1;
    ws.getCell(r, 2).value = w.code || null;
    ws.getCell(r, 3).value = w.name || null;
    w.projects.forEach((p, k) => {
      const c = first + k * 4;
      ws.getCell(r, c).value = p.label;
      ws.getCell(r, c + 1).value = p.bDays;
      ws.getCell(r, c + 2).value = p.sundays;
      ws.getCell(r, c + 3).value = p.otHours;
    });
    ws.getCell(r, bDays).value = { formula: `SUM(${slotCols(1, r)})` };
    ws.getCell(r, sun).value = { formula: `SUM(${slotCols(2, r)})` };
    ws.getCell(r, days).value = { formula: `${col(bDays)}${r}+${col(sun)}${r}` };
    ws.getCell(r, basic).value = { formula: `${col(days)}${r}*${BASIC_HOURS_PER_DAY}` };
    ws.getCell(r, ot).value = { formula: `SUM(${slotCols(3, r)})` };
    ws.getCell(r, claim).value = { formula: `${col(basic)}${r}+${col(ot)}${r}` };
    for (let c = 1; c <= last; c++) ws.getCell(r, c).border = BOX;
    r++;
  });
  const lastWorker = r - 1;
  ws.getCell(r, 3).value = "TOTAL";
  ws.getCell(r, 3).font = { bold: true };
  for (const c of [basic, ot, claim, days, bDays, sun]) {
    ws.getCell(r, c).value = { formula: `SUM(${col(c)}4:${col(c)}${lastWorker})` };
    ws.getCell(r, c).font = { bold: true };
  }

  // Project / site billing summary — rate is typed in, everything else is a formula.
  r += 3;
  ws.getCell(r - 1, 1).value = "PROJECT / SITE SUMMARY";
  ws.getCell(r - 1, 1).font = { bold: true, size: 12 };
  const heads = ["S/N", "CLIENT", "PROJECT / SITE", "TOTAL WORKERS", "G HOURS", "OT HOURS", "TOTAL HOURS", "U/RATE", "TOTAL AMOUNT", "GST 9%", "WITH GST AMOUNT"];
  heads.forEach((t, i) => headerCell(ws, r, i + 1, t));
  const top = r + 1;
  summary.projects.forEach((p, i) => {
    r++;
    const values = [i + 1, p.clientName || null, p.label, p.workers, p.normalHours, p.otHours];
    values.forEach((v, j) => (ws.getCell(r, j + 1).value = v));
    ws.getCell(r, 7).value = { formula: `E${r}+F${r}` };
    ws.getCell(r, 9).value = { formula: `G${r}*H${r}` };
    ws.getCell(r, 10).value = { formula: `ROUND(I${r}*${GST_RATE},2)` };
    ws.getCell(r, 11).value = { formula: `I${r}+J${r}` };
    for (let c = 1; c <= heads.length; c++) ws.getCell(r, c).border = BOX;
  });
  r++;
  ws.getCell(r, 3).value = "TOTAL";
  // A worker on two projects is counted once in the total, not once per project.
  ws.getCell(r, 4).value = summary.workers.length;
  for (const c of [5, 6, 7, 9, 10, 11]) ws.getCell(r, c).value = { formula: `SUM(${col(c)}${top}:${col(c)}${r - 1})` };
  for (let c = 1; c <= heads.length; c++) { ws.getCell(r, c).font = { bold: true }; ws.getCell(r, c).border = BOX; }
  for (const c of [9, 10, 11]) for (let row = top; row <= r; row++) ws.getCell(row, c).numFmt = "#,##0.00";

  ws.getColumn(1).width = 6;
  ws.getColumn(2).width = 13;
  ws.getColumn(3).width = 30;
  for (let k = 0; k < slots; k++) { ws.getColumn(first + k * 4).width = 26; for (let i = 1; i < 4; i++) ws.getColumn(first + k * 4 + i).width = 9; }
  for (const [c] of tail) ws.getColumn(c).width = 11;
  ws.getColumn(remark).width = 18;
  ws.views = [{ state: "frozen", xSplit: 3, ySplit: 3 }];
}

export async function createCompanyClaimWorkbook(summary: CompanyClaimSummary, employees: Employee[], companies: Company[], month: string, lookups: ClaimLookups = {}) {
  const workbook = await createClaimWorkbook(summary.sheets, employees, companies, month, lookups);
  // The first project is written into the template sheet itself; name it after its project like the rest.
  const firstGroup = groupClaimsByProject(summary.sheets, employees, month, { ...lookups, companies })[0];
  const base = workbook.worksheets[0];
  if (base && firstGroup) {
    const taken = new Set(workbook.worksheets.slice(1).map((s) => s.name.toUpperCase()));
    let projectName = (firstGroup.projectName || "PROJECT 1").replace(/[\\/*?:[\]]/g, " ").slice(0, 28).trim() || "PROJECT 1";
    for (let n = 2; taken.has(projectName.toUpperCase()); n++) projectName = `${projectName.slice(0, 25)} ${n}`;
    base.name = projectName;
  }
  const used = new Set(workbook.worksheets.map((s) => s.name.toUpperCase()));
  let name = `${summary.companyCode || summary.companyName}`.replace(/[\\/*?:[\]]/g, " ").slice(0, 20).trim() + " COMBINED";
  while (used.has(name.toUpperCase())) name = `${name.slice(0, 28)}_`;
  const ws = workbook.addWorksheet(name);
  writeCombinedSheet(ws, summary, month);
  // Put the summary first and open the file on it.
  // ExcelJS writes sheets by `orderNo` (a runtime field missing from its types).
  const order = (s: Worksheet, n: number) => ((s as unknown as { orderNo: number }).orderNo = n);
  const others = workbook.worksheets.filter((s) => s.id !== ws.id);
  order(ws, 0);
  others.forEach((s, i) => order(s, i + 1));
  workbook.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: "visible" }];
  return workbook;
}

export function companyClaimFileName(summary: CompanyClaimSummary, month: string) {
  const who = (summary.companyCode || summary.companyName).replace(/[\\/:*?"<>|]/g, " ").trim().toUpperCase();
  return `${who} CLAIM SHEET COMBINED - ${monthLabel(month)}.xlsx`;
}

export async function downloadCompanyClaimWorkbook(summary: CompanyClaimSummary, employees: Employee[], companies: Company[], month: string, lookups: ClaimLookups = {}) {
  const workbook = await createCompanyClaimWorkbook(summary, employees, companies, month, lookups);
  downloadClaimBlob(await claimWorkbookBlob(workbook), companyClaimFileName(summary, month));
}
