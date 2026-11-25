import type { Project, ProjectStatus } from "@/lib/types";

export type ProjectImportInput = Omit<Project, "id" | "code" | "createdAt" | "updatedAt">;
export interface ClientRef { id: string; name: string; code?: string }
export interface ExistingProjectRef { clientId: string; name: string }

export const PROJECT_IMPORT_FIELDS = [
  { key: "client", label: "Client Name", required: true, example: "Active Service Pte Ltd" },
  { key: "name", label: "Project / Site", required: true, example: "VSMC" },
  { key: "location", label: "Location", example: "Woodlands" },
  { key: "status", label: "Status", example: "Active" },
  { key: "startDate", label: "Start Date", example: "2026-01-01" },
  { key: "endDate", label: "End Date", example: "2026-12-31" },
  { key: "requiredWorkers", label: "Required Workers", example: "10" },
  { key: "projectManager", label: "Project Manager", example: "Tan Wei Ming" },
  { key: "safetyOfficer", label: "Safety Officer", example: "Lim Ah Kow" },
] as const;

const STATUSES: ProjectStatus[] = ["Planning", "Active", "On Hold", "Completed", "Cancelled"] as ProjectStatus[];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Rows → projects. Client must match an existing client name/code; same client + project name is skipped. */
export function prepareProjectImport(rows: Record<string, string>[], clients: ClientRef[], existing: ExistingProjectRef[]) {
  const ids = new Map<string, string>();
  for (const c of clients) {
    ids.set(c.name.trim().toLowerCase(), c.id);
    if (c.code) ids.set(c.code.trim().toLowerCase(), c.id);
  }
  const seen = new Set(existing.map((p) => `${p.clientId}|${p.name.trim().toLowerCase()}`));
  const projects: ProjectImportInput[] = [];
  const errors: string[] = [];
  rows.forEach((row, i) => {
    const line = i + 2;
    const clientText = (row.client ?? "").trim();
    const name = (row.name ?? "").trim();
    if (!clientText) { errors.push(`Row ${line}: missing Client Name`); return; }
    if (!name) { errors.push(`Row ${line}: missing Project / Site`); return; }
    const clientId = ids.get(clientText.toLowerCase());
    if (!clientId) { errors.push(`Row ${line}: client "${clientText}" not found, add the client first`); return; }
    const key = `${clientId}|${name.toLowerCase()}`;
    if (seen.has(key)) { errors.push(`Row ${line}: "${name}" already exists for ${clientText}, skipped`); return; }
    seen.add(key);
    const rawStatus = (row.status ?? "").trim().toLowerCase();
    const date = (v?: string) => { const t = (v ?? "").trim(); return DATE.test(t) ? t : undefined; };
    const workers = Number((row.requiredWorkers ?? "").trim());
    projects.push({
      clientId,
      name,
      location: (row.location ?? "").trim(),
      status: STATUSES.find((s) => s.toLowerCase() === rawStatus) ?? ("Active" as ProjectStatus),
      startDate: date(row.startDate),
      endDate: date(row.endDate),
      requiredWorkers: Number.isFinite(workers) && workers > 0 ? Math.round(workers) : 0,
      projectManager: (row.projectManager ?? "").trim() || undefined,
      safetyOfficer: (row.safetyOfficer ?? "").trim() || undefined,
    });
  });
  return { projects, errors };
}
