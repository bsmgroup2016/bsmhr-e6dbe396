import { orderedCompanies } from "./company-overview";
import { NO_COMPANY, type CompanyClaimSummary, type SummaryProject, type SummaryWorker } from "./company-claim-summary";
import type { Company } from "@/lib/types";

/**
 * Claim-workflow filters. Pure so the page tables and the Excel downloads read the
 * same predicate: whatever is on screen is exactly what gets exported.
 */
export const ALL = "all";

export interface ClaimFilter { company: string; search: string; status: string }

export const emptyClaimFilter = (): ClaimFilter => ({ company: ALL, search: "", status: ALL });

export const isClaimFilterActive = (filter: ClaimFilter) =>
  filter.company !== ALL || filter.search.trim() !== "" || filter.status !== ALL;

const norm = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
const hit = (needles: (string | undefined)[], term: string) =>
  !term || needles.some((needle) => norm(needle ?? "").includes(term));

/** Company options for the filter: registered companies in display order, then claim-only ones. */
export function claimFilterCompanyOptions(summaries: CompanyClaimSummary[], companies: Company[]) {
  const options = orderedCompanies(companies).map((c) => ({ value: c.id, label: c.name }));
  const seen = new Set(options.map((o) => o.value));
  for (const summary of summaries) {
    if (summary.companyId !== NO_COMPANY && !seen.has(summary.companyId)) {
      options.push({ value: summary.companyId, label: summary.companyName });
      seen.add(summary.companyId);
    }
  }
  if (summaries.some((s) => s.companyId === NO_COMPANY)) options.push({ value: NO_COMPANY, label: "No company set" });
  return options;
}

/** Keep the companies the filter matches, and inside them only the matching rows. */
export function filterClaimSummaries(summaries: CompanyClaimSummary[], filter: ClaimFilter): CompanyClaimSummary[] {
  const term = norm(filter.search);
  const company = filter.company === ALL ? "" : filter.company;
  const kept: CompanyClaimSummary[] = [];
  for (const summary of summaries) {
    if (company && summary.companyId !== company) continue;
    if (!term || hit([summary.companyName, summary.companyCode], term)) { kept.push(summary); continue; }
    const projectHit = (p: SummaryProject) => hit([p.label, p.projectName, p.siteName, p.clientName], term);
    const workerHit = (w: SummaryWorker) => hit([w.name, w.code], term);
    const projectHits = new Set(summary.projects.filter(projectHit).map((p) => p.key));
    const workerHits = new Set(summary.workers.filter(workerHit).map((w) => w.key));
    // A project stays when it matches, or when a matching worker worked there; a worker
    // stays when they match, or when they worked on a matching project.
    const projects = summary.projects.filter((p) =>
      projectHits.has(p.key) || summary.workers.some((w) => workerHits.has(w.key) && w.projects.some((slot) => slot.key === p.key)));
    const workers = summary.workers.filter((w) => workerHits.has(w.key) || w.projects.some((slot) => projectHits.has(slot.key)));
    if (projects.length || workers.length) kept.push({ ...summary, projects, workers });
  }
  return kept;
}

/** Salary rows carry the company name, not its id, so the caller resolves the label first. */
export interface SalaryFilterRow { Company: string; "P-File number": string; Name: string; Status: string }

export function filterSalaryRows<T extends SalaryFilterRow>(
  rows: T[],
  filter: ClaimFilter,
  companyName: string | null,
): T[] {
  const term = norm(filter.search);
  return rows.filter((row) =>
    (!companyName || row.Company === companyName) &&
    (filter.status === ALL || row.Status === filter.status) &&
    hit([row.Company, row["P-File number"], row.Name], term));
}

export function claimSalaryStatuses<T extends SalaryFilterRow>(rows: T[]) {
  return [...new Set(rows.map((row) => row.Status))].sort((a, b) => a.localeCompare(b));
}
