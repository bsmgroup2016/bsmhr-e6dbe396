import type { ClaimSheet, Client, Company, Employee, Project, Site } from "@/lib/types";

/**
 * Month-end claim roll-up per company (BSM / VRL / Pluto …): every project/site the
 * company's saved claims touch, and each worker's days and OT per project. Pure — the
 * Excel writer and the page both read this, so their numbers can never drift apart.
 */
export interface WorkerProject { key: string; label: string; bDays: number; sundays: number; normalHours: number; otHours: number }
export interface SummaryWorker { key: string; code: string; name: string; projects: WorkerProject[] }
export interface SummaryProject { key: string; label: string; projectName: string; siteName: string; clientName: string; workers: number; normalHours: number; otHours: number }
export interface CompanyClaimSummary {
  companyId: string;
  companyName: string;
  companyCode: string;
  sheets: ClaimSheet[];
  projects: SummaryProject[];
  workers: SummaryWorker[];
}

export interface SummaryLookups { projects?: Project[]; sites?: Site[]; clients?: Client[] }

export const NO_COMPANY = "__none__";
const isSunday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
const round = (n: number) => Math.round(n * 100) / 100;

/** Same project/site split the claim workbook uses, so summary rows match its sheets. */
function locate(entry: ClaimSheet["snapshot"][number], lookups: SummaryLookups) {
  const project = lookups.projects?.find((p) => p.id === entry.projectId);
  const site = lookups.sites?.find((s) => s.id === entry.siteId);
  const projectName = entry.projectId ? (project?.name || entry.projectName || "").trim() : "";
  const siteName = (entry.site || site?.name || "").trim();
  const clientName = lookups.clients?.find((c) => c.id === project?.clientId)?.name ?? "";
  const label = [projectName, siteName].filter((v, i, all) => v && all.indexOf(v) === i).join(" — ") || "Unassigned project";
  return { key: `${entry.projectId || "UNASSIGNED"}|${siteName}`, label, projectName, siteName, clientName };
}

export function companyClaimSummaries(sheets: ClaimSheet[], employees: Employee[], companies: Company[], month: string, lookups: SummaryLookups = {}): CompanyClaimSummary[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Choose a valid claim month");
  type Bucket = { sheets: ClaimSheet[]; projects: Map<string, SummaryProject & { ids: Set<string> }>; workers: Map<string, SummaryWorker> };
  const byCompany = new Map<string, Bucket>();

  for (const sheet of sheets) {
    const rows = sheet.snapshot.filter((r) => r.date.startsWith(month) && (r.normalHours || r.otHours));
    if (!rows.length) continue;
    const employee = employees.find((e) => e.id === sheet.employeeId);
    const companyId = sheet.companyId || employee?.companyId || NO_COMPANY;
    const bucket: Bucket = byCompany.get(companyId) ?? { sheets: [], projects: new Map(), workers: new Map() };
    bucket.sheets.push(sheet);
    for (const entry of rows) {
      const where = locate(entry, lookups);
      const workerKey = sheet.employeeId || entry.employeeId || entry.employeeCode?.trim().toUpperCase() || entry.sourceCardId || sheet.id;
      const project = bucket.projects.get(where.key) ?? { ...where, workers: 0, normalHours: 0, otHours: 0, ids: new Set<string>() };
      project.ids.add(workerKey);
      project.normalHours += entry.normalHours || 0;
      project.otHours += entry.otHours || 0;
      bucket.projects.set(where.key, project);

      const worker = bucket.workers.get(workerKey) ?? { key: workerKey, code: entry.employeeCode || employee?.employeeCode || "", name: (entry.workerName || employee?.name || "").toUpperCase(), projects: [] };
      let slot = worker.projects.find((p) => p.key === where.key);
      if (!slot) { slot = { key: where.key, label: where.label, bDays: 0, sundays: 0, normalHours: 0, otHours: 0 }; worker.projects.push(slot); }
      if (isSunday(entry.date)) slot.sundays++; else slot.bDays++;
      slot.normalHours += entry.normalHours || 0;
      slot.otHours += entry.otHours || 0;
      bucket.workers.set(workerKey, worker);
    }
    byCompany.set(companyId, bucket);
  }

  return [...byCompany.entries()].map(([companyId, b]) => {
    const company = companies.find((c) => c.id === companyId);
    return {
      companyId,
      companyName: company?.name ?? (companyId === NO_COMPANY ? "No company set" : "Unknown company"),
      companyCode: company?.code ?? "",
      sheets: b.sheets,
      projects: [...b.projects.values()]
        .map(({ ids, ...p }) => ({ ...p, workers: ids.size, normalHours: round(p.normalHours), otHours: round(p.otHours) }))
        .sort((x, y) => x.label.localeCompare(y.label)),
      workers: [...b.workers.values()]
        .map((w) => ({ ...w, projects: w.projects.map((p) => ({ ...p, normalHours: round(p.normalHours), otHours: round(p.otHours) })) }))
        .sort((x, y) => x.code.localeCompare(y.code, undefined, { numeric: true }) || x.name.localeCompare(y.name)),
    };
  }).sort((x, y) => (x.companyId === NO_COMPANY ? 1 : y.companyId === NO_COMPANY ? -1 : x.companyName.localeCompare(y.companyName)));
}
