import { loadClaimTemplate } from "@/lib/claim-template";
import { claimTemplateLayout, selectClaimTemplate } from "@/core/claim-template";
import { expandClaimSlots } from "@/core/claim-template-expand";
import type { ClaimSheet, Client, Company, Employee, Project, Site } from "@/lib/types";


/** Per generated page: template slot count and the rows added for extra workers (for preview). */
export const claimExpansion = new WeakMap<object, { templateSlots: number; added: number; firstAddedRow: number; workers: number }>();

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
  const sources = new Set<string>();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Choose a valid claim month");
  for (const sheet of sheets) {
    const employee = employees.find((e) => e.id === sheet.employeeId);
    const company = lookups.companies?.find((c) => c.id === sheet.companyId);
    for (const entry of sheet.snapshot) {
      const parsed = new Date(`${entry.date}T00:00:00Z`);
      if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== entry.date) throw new Error(`Invalid date ${entry.date}. Review the source card; no hours have been omitted.`);
      if (!entry.date.startsWith(month) || (!entry.normalHours && !entry.otHours)) continue;
      const source = `${entry.sourceCardId || sheet.id}|${entry.employeeCode || sheet.employeeId || entry.workerName || ""}|${entry.date}`;
      if (sources.has(source)) throw new Error(`Duplicate source entry ${entry.employeeCode || entry.workerName || sheet.reference} · ${entry.date}. Review the duplicate before downloading.`);
      sources.add(source);
      const project = lookups.projects?.find((p) => p.id === entry.projectId);
      const site = lookups.sites?.find((s) => s.id === entry.siteId);
      const projectName = entry.projectId ? (project?.name || entry.projectName || "").trim() : "";
      const siteName = (entry.site || site?.name || "").trim();
      const key = `${entry.projectId || "UNASSIGNED"}|${siteName}|${sheet.companyId ?? ""}`;
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
  for (const sheet of [...workbook.worksheets]) if (sheet.id !== base.id) {
    let isClaim = false;
    try { claimTemplateLayout(sheet); isClaim = true; } catch { /* preserve support sheets */ }
    if (isClaim) workbook.removeWorksheet(sheet.id);
  }
  const baseModel = structuredClone(base.model);

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const used = new Set(workbook.worksheets.filter(sheet => sheet.id !== base.id).map(sheet => sheet.name.toUpperCase()));

  groups.forEach((group, index) => {
    let name = (group.projectName || `PROJECT ${index + 1}`).replace(/[\\/*?:[\]]/g, " ").slice(0, 28).trim() || `PROJECT ${index + 1}`;
    const stem = name;
    let suffix = 2;
    while (used.has(name.toUpperCase())) name = `${stem.slice(0, 25)} ${suffix++}`;
    used.add(name.toUpperCase());
    let page = base;
    if (index === 0) { used.add(base.name.toUpperCase()); /* keep the template sheet name */ }
    else { page = workbook.addWorksheet(name); page.model = { ...structuredClone(baseModel), name, id: page.id } as typeof baseModel; for (const range of (baseModel as { merges?: string[] }).merges ?? []) { try { page.mergeCells(range); } catch { /* already merged */ } } }

    // Fill only the three title cells; the template's styling, formulas and columns stay untouched.
    if (layout.headerRow >= 4) {
      page.getCell("A1").value = (group.clientName || group.projectName).toUpperCase() || null;
      page.getCell("A2").value = group.siteName || null;
      const label = String(page.getCell("A3").value ?? "").trim() || "CLAIM SHEET FOR";
      page.getCell("A3").value = `${label.replace(/\s+[A-Z]{3}\s+\d{4}$/, "")} ${monthLabel(month)}`;
    }

    // Date header formulas follow the claim month (=DATE(y,m,d)); other header cells stay untouched.
    for (const col of layout.days.values()) {
      const cell = page.getCell(layout.headerRow, col);
      const v = cell.value as { formula?: string } | null;
      if (v && typeof v === "object" && typeof v.formula === "string") {
        const f = v.formula.replace(/DATE\(\s*\d+\s*,\s*\d+\s*,/i, `DATE(${y},${m},`);
        if (f !== v.formula) cell.value = { formula: f } as never;
      }
    }

    // More workers than template slots: copy the last slot so format and formulas carry over.
    const extra = group.workers.size - layout.slots.length;
    const pageLayout = extra > 0 ? (expandClaimSlots(page, layout.slots, extra, layout.serialCol), claimTemplateLayout(page)) : layout;
    claimExpansion.set(page, { templateSlots: layout.slots.length, added: Math.max(0, extra), firstAddedRow: (layout.slots.at(-1)?.ot ?? 0) + 1, workers: group.workers.size });
    const workers = [...group.workers.values()].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
    for (const worker of workers) for (const day of worker.days.keys()) {
      if (!layout.days.has(day)) throw new Error(`The blank template has no column for day ${day}. Replace it with a template containing that day.`);
    }
    // Only writable identity/date inputs are cleared; formulas, style and other cells remain intact.
    for (const slot of pageLayout.slots) {
      page.getCell(slot.g, layout.codeCol).value = null;
      page.getCell(slot.g, layout.nameCol).value = null;
      for (const row of [slot.g, slot.ot]) for (const col of layout.days.values()) page.getCell(row, col).value = null;
    }
    for (let i = 0; i < pageLayout.slots.length; i++) {
      const { g: r, ot } = pageLayout.slots[i];
      const worker = workers[i];
      if (!worker) continue;
      if (layout.serialCol && i >= layout.slots.length) page.getCell(r, layout.serialCol).value = i + 1;
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
  claimTemplateSource.set(workbook, { buffer, baseName: base.name });
  return workbook;
}

/** Template each generated workbook came from, so the saved file can keep parts ExcelJS cannot round-trip. */
const claimTemplateSource = new WeakMap<object, { buffer: ArrayBuffer; baseName: string }>();

const CF_RE = /<conditionalFormatting\b[^>]*\/>|<conditionalFormatting\b[\s\S]*?<\/conditionalFormatting>/g;

async function sheetXmlByName(zip: import("jszip"), name?: string) {
  const wb = await zip.file("xl/workbook.xml")?.async("string") ?? "";
  const rels = await zip.file("xl/_rels/workbook.xml.rels")?.async("string") ?? "";
  const out: { name: string; index: number; path: string }[] = [];
  [...wb.matchAll(/<sheet\b[^>]*>/g)].forEach((m, index) => {
    const n = (m[0].match(/name="([^"]*)"/)?.[1] ?? "").replace(/&apos;/g, "'").replace(/&amp;/g, "&");
    const rid = m[0].match(/r:id="([^"]*)"/)?.[1];
    const rel = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map(r => r[0]).find(r => r.includes(`Id="${rid}"`));
    const target = rel?.match(/Target="([^"]*)"/)?.[1] ?? "";
    out.push({ name: n, index, path: target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}` });
  });
  return name === undefined ? out : out.filter(s => s.name.toUpperCase() === name.toUpperCase());
}

/** Repairs ExcelJS output so Excel opens it without "We found a problem": restores the template's conditional
 * formatting (ExcelJS drops rules like duplicateValues, leaving invalid empty blocks) and sheet-local filter names. */
export async function repairClaimXlsx(out: ArrayBuffer | Uint8Array, template?: { buffer: ArrayBuffer; baseName: string }) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(out);
  let templateCf: string[] | null = null;
  if (template) {
    try {
      const tz = await JSZip.loadAsync(template.buffer);
      const sheets = await sheetXmlByName(tz);
      const pick = sheets.find(s => s.name.toUpperCase() === template.baseName.toUpperCase()) ?? sheets[0];
      const xml = pick ? await tz.file(pick.path)?.async("string") : undefined;
      if (xml) templateCf = xml.match(CF_RE) ?? [];
      // Restored rules point at the template's dxf styles, so carry those over too.
      const tStyles = await tz.file("xl/styles.xml")?.async("string");
      const tDxfs = tStyles?.match(/<dxfs\b[^>]*\/>|<dxfs\b[\s\S]*?<\/dxfs>/)?.[0];
      const oStyles = await zip.file("xl/styles.xml")?.async("string");
      if (tDxfs && oStyles) zip.file("xl/styles.xml", /<dxfs\b/.test(oStyles) ? oStyles.replace(/<dxfs\b[^>]*\/>|<dxfs\b[\s\S]*?<\/dxfs>/, tDxfs) : oStyles.replace(/<tableStyles\b|<\/styleSheet>/, m => tDxfs + m));
    } catch { templateCf = null; }
  }
  const sheets = await sheetXmlByName(zip);
  for (const sheet of sheets) {
    const file = zip.file(sheet.path);
    if (!file) continue;
    let xml = await file.async("string");
    const blocks = xml.match(CF_RE);
    if (blocks?.length) {
      let first = true;
      xml = xml.replace(CF_RE, () => { if (!first) return ""; first = false; return (templateCf ?? blocks.filter(b => /<cfRule\b/.test(b))).join(""); });
    }
    zip.file(sheet.path, xml);
  }
  let wb = await zip.file("xl/workbook.xml")?.async("string");
  if (wb) {
    wb = wb.replace(/<definedName name="_xlnm\._FilterDatabase"(?![^>]*localSheetId)([^>]*)>([^<]*)<\/definedName>/g, (all, attrs: string, ref: string) => {
      const target = ref.replace(/&apos;/g, "'").match(/^'?(.*?)'?!/)?.[1] ?? "";
      const sheet = sheets.find(s => s.name.toUpperCase() === target.toUpperCase());
      return sheet ? `<definedName name="_xlnm._FilterDatabase" localSheetId="${sheet.index}" hidden="1"${attrs}>${ref}</definedName>` : "";
    });
    zip.file("xl/workbook.xml", wb);
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

export async function claimWorkbookBlob(workbook: import("exceljs").Workbook) {
  workbook.calcProperties.fullCalcOnLoad = true;
  const raw = await workbook.xlsx.writeBuffer();
  const out = await repairClaimXlsx(raw as ArrayBuffer, claimTemplateSource.get(workbook));
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function downloadClaimBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function exportCombinedClaims(sheets: ClaimSheet[], employees: Employee[], _title: string, companies: Company[] = [], month = sheets[0]?.periodStart.slice(0, 7) ?? "", lookups: ClaimLookups = {}) {
  const workbook = await createClaimWorkbook(sheets, employees, companies, month, lookups);
  downloadClaimBlob(await claimWorkbookBlob(workbook), lookups.fileName || `claim_sheet_${month}.xlsx`);
}

export interface ClaimReconcileIssue { worker: string; date: string; kind: "Missing in sheet" | "Hours differ" | "Extra in sheet" | "Worker not in sheet" | "Unexpected worker"; expected: string; actual: string; cardId?: string }

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
  const cardOf = new Map<string, string>();
  for (const sheet of sheets) for (const entry of sheet.snapshot) { const employee = employees.find(e => e.id === sheet.employeeId); const k = key(entry.employeeCode || employee?.employeeCode || "", entry.workerName || employee?.name || ""); if (!cardOf.has(k)) cardOf.set(k, entry.sourceCardId || sheet.id); }
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
  for (const [worker, days] of actual) if (!expected.has(worker)) issues.push({ worker, date: "", kind: "Unexpected worker", expected: "not present", actual: `${days.size} worked dates` });
  for (const issue of issues) issue.cardId = cardOf.get(issue.worker);
  return issues.sort((a, b) => a.worker.localeCompare(b.worker, undefined, { numeric: true }) || a.date.localeCompare(b.date));
}
