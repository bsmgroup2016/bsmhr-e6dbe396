import { loadClaimTemplate } from "@/lib/claim-template";
import { claimTemplateLayout, selectClaimTemplate } from "@/core/claim-template";
import type { ClaimSheet, Client, Company, Employee, Project, Site } from "@/lib/types";


export function claimSheetTitle(companyName: string, month: string) {
  return `${companyName.toUpperCase()} CLAIM - ${monthLabel(month)}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return y && m ? new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-SG", { month: "short", year: "numeric", timeZone: "UTC" }).toUpperCase() : month;
}

export interface ClaimLookups { companies?: Company[]; projects?: Project[]; sites?: Site[]; clients?: Client[]; fileName?: string; templateBuffer?: ArrayBuffer }

interface ProjectGroup { key: string; projectName: string; siteName: string; clientName: string; companyName: string; workers: Map<string, { code: string; name: string; days: Map<number, { g: number; ot: number }> }> }

/** Groups approved claim rows by project/site and worker. Unknown values stay blank. */
export function groupClaimsByProject(sheets: ClaimSheet[], employees: Employee[], month: string, lookups: ClaimLookups = {}) {
  const groups = new Map<string, ProjectGroup>();
  for (const sheet of sheets) {
    const employee = employees.find((e) => e.id === sheet.employeeId);
    const company = lookups.companies?.find((c) => c.id === sheet.companyId);
    for (const entry of sheet.snapshot) {
      if (!entry.date.startsWith(month) || (!entry.normalHours && !entry.otHours)) continue;
      const project = lookups.projects?.find((p) => p.id === entry.projectId);
      const site = lookups.sites?.find((s) => s.id === entry.siteId);
      const projectName = entry.projectId ? (project?.name || entry.projectName || "").trim() : "";
      const siteName = (entry.site || site?.name || "").trim();
      const key = (entry.projectId || siteName.toUpperCase() || "UNASSIGNED") + "|" + (sheet.companyId ?? "");
      const clientName = lookups.clients?.find((c) => c.id === project?.clientId)?.name ?? "";
      const group = groups.get(key) ?? { key, projectName, siteName, clientName, companyName: company?.name ?? "", workers: new Map() };
      const workerKey = sheet.employeeId || entry.employeeId || entry.employeeCode?.trim().toUpperCase() || entry.sourceCardId || sheet.id;
      const worker = group.workers.get(workerKey) ?? { code: entry.employeeCode || employee?.employeeCode || "", name: (entry.workerName || employee?.name || "").toUpperCase(), days: new Map() };
      const day = Number(entry.date.slice(8, 10));
      const cell = worker.days.get(day) ?? { g: 0, ot: 0 };
      cell.g += entry.normalHours || 0; cell.ot += entry.otHours || 0;
      worker.days.set(day, cell); group.workers.set(workerKey, worker); groups.set(key, group);
    }
  }
  return [...groups.values()];
}

export async function createClaimWorkbook(sheets: ClaimSheet[], employees: Employee[], companies: Company[] = [], month = sheets[0]?.periodStart.slice(0, 7) ?? "", lookups: ClaimLookups = {}) {
  const groups = groupClaimsByProject(sheets, employees, month, { ...lookups, companies });
  if (!groups.length) throw new Error("No approved time-card hours in this period");
  const ExcelJS = await import("exceljs");
  const buffer = lookups.templateBuffer ?? await loadClaimTemplate();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const base = selectClaimTemplate(workbook);
  const layout = claimTemplateLayout(base);
  const big = groups.find(g => g.workers.size > layout.slots.length);
  if (big) throw new Error(`${big.projectName || "A project"} has ${big.workers.size} workers but the template has only ${layout.slots.length} slots. Replace it with a larger blank template.`);
  for (const sheet of workbook.worksheets) if (sheet.id !== base.id) workbook.removeWorksheet(sheet.id);
  const baseModel = structuredClone(base.model);

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const used = new Set<string>();

  groups.forEach((group, index) => {
    let name = (group.projectName || `PROJECT ${index + 1}`).replace(/[\\/*?:[\]]/g, " ").slice(0, 28).trim() || `PROJECT ${index + 1}`;
    const stem = name;
    let suffix = 2;
    while (used.has(name.toUpperCase())) name = `${stem.slice(0, 25)} ${suffix++}`;
    used.add(name.toUpperCase());
    let page = base;
    if (index === 0) page.name = name;
    else { page = workbook.addWorksheet(name); page.model = { ...structuredClone(baseModel), name, id: page.id } as typeof baseModel; for (const range of (baseModel as { merges?: string[] }).merges ?? []) { try { page.mergeCells(range); } catch { /* already merged */ } } }

    // Fill only the three title cells; the template's styling, formulas and columns stay untouched.
    if (layout.headerRow >= 4) {
      page.getCell("A1").value = (group.clientName || group.projectName).toUpperCase() || null;
      page.getCell("A2").value = group.siteName || null;
      const label = String(page.getCell("A3").value ?? "").trim() || "CLAIM SHEET FOR";
      page.getCell("A3").value = `${label.replace(/\s+[A-Z]{3}\s+\d{4}$/, "")} ${monthLabel(month)}`;
    }

    const workers = [...group.workers.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    for (const worker of workers) for (const day of worker.days.keys()) {
      if (!layout.days.has(day)) throw new Error(`The blank template has no column for day ${day}. Replace it with a template containing that day.`);
    }
    for (let i = 0; i < layout.slots.length; i++) {
      const { g: r, ot } = layout.slots[i];
      const worker = workers[i];
      if (!worker) continue;
      page.getCell(r, layout.codeCol).value = worker.code || null;
      page.getCell(r, layout.nameCol).value = worker.name || null;
      for (const [day, v] of worker.days) {
        if (day < 1 || day > daysInMonth) continue;
        const col = layout.days.get(day);
        if (!col) continue;
        if (v.g) page.getCell(r, col).value = v.g;
        if (v.ot) page.getCell(ot, col).value = v.ot;
      }
    }
  });

  workbook.calcProperties.fullCalcOnLoad = true;
  return workbook;
}

export async function claimWorkbookBlob(workbook: import("exceljs").Workbook) {
  workbook.calcProperties.fullCalcOnLoad = true;
  const out = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(out)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function downloadClaimBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function exportCombinedClaims(sheets: ClaimSheet[], employees: Employee[], _title: string, companies: Company[] = [], month = sheets[0]?.periodStart.slice(0, 7) ?? "", lookups: ClaimLookups = {}) {
  const workbook = await createClaimWorkbook(sheets, employees, companies, month, lookups);
  downloadClaimBlob(await claimWorkbookBlob(workbook), lookups.fileName || `claim_sheet_${month}.xlsx`);
}

export interface ClaimReconcileIssue { worker: string; date: string; kind: "Missing in sheet" | "Hours differ" | "Extra in sheet" | "Worker not in sheet"; expected: string; actual: string }

/** Reads the generated workbook back and compares every worker/date cell with the approved snapshot hours. */
export function reconcileClaimWorkbook(workbook: import("exceljs").Workbook, sheets: ClaimSheet[], employees: Employee[], month: string): ClaimReconcileIssue[] {
  const num = (v: unknown) => { const raw = v && typeof v === "object" && "result" in v ? (v as { result: unknown }).result : v; const n = Number(raw); return Number.isFinite(n) ? n : 0; };
  const key = (code: string, name: string) => (code.trim() || name.trim()).toUpperCase();
  const expected = new Map<string, Map<number, { g: number; ot: number }>>();
  for (const sheet of sheets) {
    const employee = employees.find(e => e.id === sheet.employeeId);
    for (const entry of sheet.snapshot) {
      if (!entry.date.startsWith(month) || (!entry.normalHours && !entry.otHours)) continue;
      const k = key(entry.employeeCode || employee?.employeeCode || "", entry.workerName || employee?.name || "");
      const days = expected.get(k) ?? new Map(); const day = Number(entry.date.slice(8, 10));
      const cell = days.get(day) ?? { g: 0, ot: 0 }; cell.g += entry.normalHours || 0; cell.ot += entry.otHours || 0;
      days.set(day, cell); expected.set(k, days);
    }
  }
  const actual = new Map<string, Map<number, { g: number; ot: number }>>();
  for (const page of workbook.worksheets) {
    let layout; try { layout = claimTemplateLayout(page); } catch { continue; }
    for (const { g: r, ot } of layout.slots) {
      const code = String(page.getCell(r, layout.codeCol).value ?? ""), name = String(page.getCell(r, layout.nameCol).value ?? "");
      if (!code.trim() && !name.trim()) continue;
      const days = actual.get(key(code, name)) ?? new Map();
      for (const [day, col] of layout.days) {
        const g = num(page.getCell(r, col).value), o = num(page.getCell(ot, col).value);
        if (g || o) { const c = days.get(day) ?? { g: 0, ot: 0 }; c.g += g; c.ot += o; days.set(day, c); }
      }
      actual.set(key(code, name), days);
    }
  }
  const date = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
  const fmt = (c?: { g: number; ot: number }) => c ? `GW ${c.g} / OT ${c.ot}` : "blank";
  const issues: ClaimReconcileIssue[] = [];
  for (const [worker, days] of expected) {
    const got = actual.get(worker);
    if (!got) { issues.push({ worker, date: "", kind: "Worker not in sheet", expected: `${days.size} dates`, actual: "missing" }); continue; }
    for (const [d, c] of days) {
      const a = got.get(d);
      if (!a) issues.push({ worker, date: date(d), kind: "Missing in sheet", expected: fmt(c), actual: "blank" });
      else if (Math.abs(a.g - c.g) > 0.001 || Math.abs(a.ot - c.ot) > 0.001) issues.push({ worker, date: date(d), kind: "Hours differ", expected: fmt(c), actual: fmt(a) });
    }
    for (const [d, a] of got) if (!days.has(d)) issues.push({ worker, date: date(d), kind: "Extra in sheet", expected: "blank", actual: fmt(a) });
  }
  return issues.sort((a, b) => a.worker.localeCompare(b.worker, undefined, { numeric: true }) || a.date.localeCompare(b.date));
}
