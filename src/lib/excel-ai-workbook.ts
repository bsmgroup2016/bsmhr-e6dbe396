/**
 * Separate "AI analysis" workbook: DATA table, salary link (XLOOKUP / SUMIFS),
 * pivot sheets, flags and the AI review. Existing claim/salary downloads are untouched.
 * Every formula carries the software's own result, and totals are checked before export.
 */
import type { Workbook, Worksheet } from "exceljs";
import type { CompanyClaimSummary } from "@/core/company-claim-summary";
import type { ExcelAiPlan, PivotDimension, PivotMeasure } from "@/core/excel-ai-plan";

export interface SalaryLinkRow { Company: string; "P-File number": string; Name: string; "G hours": number; "OT hours": number; "Net pay (SGD)": number | null; Status: string }
export interface DataRow { company: string; client: string; project: string; code: string; name: string; bDays: number; sundays: number; g: number; ot: number }

const round = (n: number) => Math.round(n * 100) / 100;
const HEAD = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } } as const;

export function analysisDataRows(summaries: CompanyClaimSummary[]): DataRow[] {
  return summaries.flatMap((s) => s.workers.flatMap((w) => w.projects.map((p) => ({
    company: s.companyName, client: s.projects.find((x) => x.key === p.key)?.clientName || "", project: p.label,
    code: w.code || "", name: w.name || "", bDays: p.bDays, sundays: p.sundays, g: p.normalHours, ot: p.otHours,
  }))));
}

const DIM_COL: Record<Exclude<PivotDimension, "worker">, { col: string; get: (r: DataRow) => string }> = {
  company: { col: "A", get: (r) => r.company }, client: { col: "B", get: (r) => r.client }, project: { col: "C", get: (r) => r.project },
};
const MEASURE_LABEL: Record<PivotMeasure, string> = { gHours: "G hours", otHours: "OT hours", totalHours: "Total hours", netPay: "Net pay (SGD)" };

function head(ws: Worksheet, values: string[]) {
  const row = ws.addRow(values);
  row.eachCell((c) => { c.font = { bold: true }; c.fill = HEAD; });
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

export class ExcelAiCheckError extends Error {}

/** Builds the workbook; throws ExcelAiCheckError if any total disagrees with the software. */
export async function buildExcelAiWorkbook(summaries: CompanyClaimSummary[], salary: SalaryLinkRow[], plan: ExcelAiPlan, month: string): Promise<Workbook> {
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const rows = analysisDataRows(summaries);
  const n = rows.length + 1;
  const softwareG = round(summaries.reduce((t, s) => t + s.projects.reduce((v, p) => v + p.normalHours, 0), 0));
  const softwareOt = round(summaries.reduce((t, s) => t + s.projects.reduce((v, p) => v + p.otHours, 0), 0));
  const check = (label: string, a: number, b: number) => { if (Math.abs(round(a) - round(b)) > 0.001) throw new ExcelAiCheckError(`${label} does not match the software total (${round(a)} vs ${round(b)})`); };
  check("DATA G hours", rows.reduce((t, r) => t + r.g, 0), softwareG);
  check("DATA OT hours", rows.reduce((t, r) => t + r.ot, 0), softwareOt);

  // DATA
  const data = wb.addWorksheet("DATA");
  head(data, ["Company", "Client", "Project / site", "P-File number", "Name", "B days", "Sundays", "G hours", "OT hours", "Total hours"]);
  rows.forEach((r, i) => data.addRow([r.company, r.client, r.project, r.code, r.name, r.bDays, r.sundays, r.g, r.ot, { formula: `H${i + 2}+I${i + 2}`, result: round(r.g + r.ot) }]));
  data.addConditionalFormatting({ ref: `I2:I${Math.max(2, n)}`, rules: [{ type: "cellIs", operator: "greaterThan", priority: 1, formulae: [String(plan.otHoursAbove)], style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFC7CE" } } } }] });
  data.columns.forEach((c, i) => { c.width = [22, 22, 30, 14, 28][i] ?? 11; });
  if (rows.length) data.autoFilter = `A1:J${n}`;

  // SALARY LINK
  const sal = wb.addWorksheet("SALARY LINK");
  head(sal, ["Company", "P-File number", "Name (XLOOKUP)", "G hours (SUMIFS)", "OT hours (SUMIFS)", "Software G hours", "Software OT hours", "Net pay (SGD)", "Status", "Check"]);
  salary.forEach((s, i) => {
    const r = i + 2;
    const match = rows.filter((d) => d.company === s.Company && d.code === s["P-File number"]);
    const g = round(match.reduce((t, d) => t + d.g, 0)), ot = round(match.reduce((t, d) => t + d.ot, 0));
    const ok = s["P-File number"] ? Math.abs(g - s["G hours"]) < 0.001 && Math.abs(ot - s["OT hours"]) < 0.001 : true;
    sal.addRow([
      s.Company, s["P-File number"] || null,
      { formula: `IFERROR(_xlfn.XLOOKUP(B${r},DATA!$D:$D,DATA!$E:$E),"NOT IN CLAIM")`, result: match[0]?.name ?? s.Name },
      { formula: `SUMIFS(DATA!$H:$H,DATA!$A:$A,A${r},DATA!$D:$D,B${r})`, result: s["P-File number"] ? g : 0 },
      { formula: `SUMIFS(DATA!$I:$I,DATA!$A:$A,A${r},DATA!$D:$D,B${r})`, result: s["P-File number"] ? ot : 0 },
      s["G hours"], s["OT hours"], s["Net pay (SGD)"], s.Status,
      { formula: `IF(B${r}="","NO P-FILE",IF(AND(ABS(D${r}-F${r})<0.01,ABS(E${r}-G${r})<0.01),"OK","MISMATCH"))`, result: s["P-File number"] ? (ok ? "OK" : "MISMATCH") : "NO P-FILE" },
    ]);
    if (!ok) throw new ExcelAiCheckError(`Salary hours for ${s.Name || s["P-File number"]} do not match the claim data`);
  });
  sal.getColumn(8).numFmt = "#,##0.00";
  sal.columns.forEach((c, i) => { c.width = [22, 14, 28][i] ?? 14; });

  // PIVOTS
  const used = new Set(["DATA", "SALARY LINK"]);
  for (const p of plan.pivots) {
    let name = `PIVOT ${p.title}`.replace(/[\\/*?:[\]]/g, " ").slice(0, 31).trim();
    for (let k = 2; used.has(name.toUpperCase()); k++) name = `${name.slice(0, 28)} ${k}`;
    used.add(name.toUpperCase());
    const ws = wb.addWorksheet(name);
    const byWorker = p.rows === "worker";
    head(ws, [...(byWorker ? ["Company", "P-File number", "Name"] : [p.rows[0]!.toUpperCase() + p.rows.slice(1)]), ...p.measures.map((m) => MEASURE_LABEL[m])]);
    const keys = byWorker
      ? [...new Map(rows.map((r) => [`${r.company}|${r.code}`, r])).values()].map((r) => ({ match: (d: DataRow) => d.company === r.company && d.code === r.code, cells: [r.company, r.code, r.name], crit: (row: number) => `DATA!$A:$A,A${row},DATA!$D:$D,B${row}`, salCrit: (row: number) => `'SALARY LINK'!$A:$A,A${row},'SALARY LINK'!$B:$B,B${row}`, sal: (s: SalaryLinkRow) => s.Company === r.company && s["P-File number"] === r.code }))
      : [...new Set(rows.map(DIM_COL[p.rows as "company"].get))].sort().map((v) => { const d = DIM_COL[p.rows as "company"]; return { match: (x: DataRow) => d.get(x) === v, cells: [v], crit: (row: number) => `DATA!$${d.col}:$${d.col},A${row}`, salCrit: (row: number) => `'SALARY LINK'!$A:$A,A${row}`, sal: (s: SalaryLinkRow) => s.Company === v }; });
    const first = byWorker ? 4 : 2;
    let gSum = 0, otSum = 0;
    keys.forEach((k, i) => {
      const r = i + 2, m = rows.filter(k.match);
      const g = round(m.reduce((t, d) => t + d.g, 0)), ot = round(m.reduce((t, d) => t + d.ot, 0));
      gSum += g; otSum += ot;
      ws.addRow([...k.cells, ...p.measures.map((ms) => {
        if (ms === "gHours") return { formula: `SUMIFS(DATA!$H:$H,${k.crit(r)})`, result: g };
        if (ms === "otHours") return { formula: `SUMIFS(DATA!$I:$I,${k.crit(r)})`, result: ot };
        if (ms === "totalHours") return { formula: `SUMIFS(DATA!$J:$J,${k.crit(r)})`, result: round(g + ot) };
        return { formula: `SUMIFS('SALARY LINK'!$H:$H,${k.salCrit(r)})`, result: round(salary.filter(k.sal).reduce((t, s) => t + (s["Net pay (SGD)"] ?? 0), 0)) };
      })]);
    });
    check(`${name} G hours`, gSum, softwareG);
    check(`${name} OT hours`, otSum, softwareOt);
    const last = keys.length + 1;
    const total = ws.addRow([...(byWorker ? ["", "", "TOTAL"] : ["TOTAL"]), ...p.measures.map((_, j) => {
      const c = String.fromCharCode(64 + first + j);
      return { formula: `SUM(${c}2:${c}${last})` };
    })]);
    total.font = { bold: true };
    p.measures.forEach((ms, j) => { if (ms === "netPay") ws.getColumn(first + j).numFmt = "#,##0.00"; });
    ws.columns.forEach((c, i) => { c.width = i < first - 1 ? 28 : 14; });
  }

  // FLAGS (software rules) and AI REVIEW (advisory)
  const flags = wb.addWorksheet("FLAGS");
  head(flags, ["Type", "Company", "P-File number", "Name", "Detail"]);
  const otByWorker = new Map<string, { r: DataRow; ot: number }>();
  for (const r of rows) { const k = `${r.company}|${r.code}|${r.name}`; const e = otByWorker.get(k) ?? { r, ot: 0 }; e.ot += r.ot; otByWorker.set(k, e); }
  for (const { r, ot } of otByWorker.values()) if (ot > plan.otHoursAbove) flags.addRow(["High OT", r.company, r.code, r.name, `${round(ot)} OT hours (limit ${plan.otHoursAbove})`]);
  for (const s of salary) if (s["Net pay (SGD)"] === null) flags.addRow(["Payroll missing", s.Company, s["P-File number"], s.Name, s.Status]);
  const codes = new Map<string, Set<string>>();
  for (const s of salary) if (s["P-File number"]) codes.set(s["P-File number"], (codes.get(s["P-File number"]) ?? new Set()).add(s.Company));
  for (const [code, cs] of codes) if (cs.size > 1) flags.addRow(["Same P-File in several companies", [...cs].join(", "), code, "", "Check worker identity"]);
  if (flags.rowCount === 1) flags.addRow(["No flags", "", "", "", ""]);
  flags.columns.forEach((c, i) => { c.width = [30, 24, 14, 28, 40][i] ?? 14; });

  const review = wb.addWorksheet("AI REVIEW");
  head(review, ["Severity", "Worker", "Note (advisory — verify before acting)"]);
  if (plan.notes.length) plan.notes.forEach((x) => review.addRow([x.severity.toUpperCase(), x.worker, x.message]));
  else review.addRow(["—", "", "No AI notes for this month."]);
  review.addRow([]);
  review.addRow(["", "", `Month ${month}. All hours and pay come from the software; formulas were checked against its totals.`]);
  review.columns.forEach((c, i) => { c.width = [10, 28, 90][i] ?? 14; });
  return wb;
}
