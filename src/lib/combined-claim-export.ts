import template from "@/assets/project-claim-template.xlsx.asset.json";
import type { ClaimSheet, Client, Company, Employee, Project, Site } from "@/lib/types";

/** Layout of the supplied blank template (sheet "CLAIM SHEET"). */
const FIRST_ROW = 5; // each worker uses two rows: G-HRS then OT HOURS
const SLOTS = 60;
const DAY_COL = 5; // column E = day 1

export function claimSheetTitle(companyName: string, month: string) {
  return `${companyName.toUpperCase()} CLAIM - ${monthLabel(month)}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return y && m ? new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-SG", { month: "short", year: "numeric", timeZone: "UTC" }).toUpperCase() : month;
}

export interface ClaimLookups { companies?: Company[]; projects?: Project[]; sites?: Site[]; clients?: Client[]; fileName?: string }

interface ProjectGroup { key: string; projectName: string; clientName: string; companyName: string; workers: Map<string, { code: string; name: string; days: Map<number, { g: number; ot: number }> }> }

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
      const projectName = (entry.projectName || project?.name || site?.name || entry.site || "").trim();
      const key = (entry.projectId || projectName.toUpperCase() || "UNASSIGNED") + "|" + (sheet.companyId ?? "");
      const clientName = lookups.clients?.find((c) => c.id === project?.clientId)?.name ?? "";
      const group = groups.get(key) ?? { key, projectName, clientName, companyName: company?.name ?? "", workers: new Map() };
      const workerKey = sheet.employeeId ?? sheet.id;
      const worker = group.workers.get(workerKey) ?? { code: employee?.employeeCode ?? "", name: (employee?.name ?? "").toUpperCase(), days: new Map() };
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
  const big = groups.find((g) => g.workers.size > SLOTS);
  if (big) throw new Error(`${big.projectName || "A project"} has more than ${SLOTS} workers; the template holds ${SLOTS}.`);

  const ExcelJS = await import("exceljs");
  const response = await fetch(template.url);
  if (!response.ok) throw new Error("Could not load the claim sheet template");
  const buffer = await response.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const base = workbook.worksheets[0];
  if (!base) throw new Error("Claim template is missing");
  const baseModel = base.model;

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const used = new Set<string>();

  groups.forEach((group, index) => {
    let name = (group.projectName || `PROJECT ${index + 1}`).replace(/[\\/*?:[\]]/g, " ").slice(0, 28).trim() || `PROJECT ${index + 1}`;
    while (used.has(name.toUpperCase())) name = `${name.slice(0, 25)} ${index + 1}`;
    used.add(name.toUpperCase());
    let page = base;
    if (index === 0) page.name = name;
    else { page = workbook.addWorksheet(name); page.model = { ...baseModel, name, id: page.id } as typeof baseModel; for (const range of (baseModel as { merges?: string[] }).merges ?? []) { try { page.mergeCells(range); } catch { /* already merged */ } } }

    page.getCell("A1").value = group.clientName ? group.clientName.toUpperCase() : null;
    page.getCell("A2").value = group.projectName ? group.projectName.toUpperCase() : null;
    page.getCell("A3").value = `CLAIM FOR ${monthLabel(month)}`;
    page.getCell("AN1").value = group.companyName ? group.companyName.toUpperCase() : null;

    for (let d = 1; d <= 31; d++) {
      const col = DAY_COL + d - 1;
      const head = page.getCell(4, col);
      if (d > daysInMonth) { head.value = null; page.getColumn(col).hidden = true; continue; }
      const sunday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
      head.style = { ...head.style, fill: { type: "pattern", pattern: "solid", fgColor: { argb: sunday ? "FFFF0000" : "FFFFFFFF" } } };
    }

    const workers = [...group.workers.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    for (let i = 0; i < SLOTS; i++) {
      const r = FIRST_ROW + i * 2;
      const worker = workers[i];
      if (!worker) { page.getRow(r).hidden = true; page.getRow(r + 1).hidden = true; continue; }
      page.getCell(r, 2).value = worker.code || null;
      page.getCell(r, 3).value = worker.name || null;
      for (const [day, v] of worker.days) {
        if (day < 1 || day > daysInMonth) continue;
        if (v.g) page.getCell(r, DAY_COL + day - 1).value = v.g;
        if (v.ot) page.getCell(r + 1, DAY_COL + day - 1).value = v.ot;
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
