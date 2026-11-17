import type { BranchPrefix, Company } from "@/lib/types";

const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

/** Company a branch points to: its branch prefix's linked company first, then an exact company name/code match. */
export function branchCompanyId(branch: string | undefined, companies: Company[], prefixes: BranchPrefix[] = []): string | undefined {
  if (!branch) return undefined;
  const prefix = prefixes.find(p => normalize(p.name) === normalize(branch) || normalize(p.code) === normalize(branch));
  if (prefix?.companyId && companies.some(c => c.id === prefix.companyId)) return prefix.companyId;
  const matches = companies.filter(company => [company.name, company.legalName, company.code].some(name => name && normalize(name) === normalize(branch)));
  return matches.length === 1 ? matches[0].id : undefined;
}

/** The selected branch determines the employee's company when it maps to one; otherwise (e.g. "Unassigned") the existing/fallback company is kept. */
export function employeeCompanyId(branch: string | undefined, companies: Company[], fallback?: string, prefixes: BranchPrefix[] = []): string {
  const mapped = branchCompanyId(branch, companies, prefixes);
  if (mapped) return mapped;
  if (fallback && companies.some(company => company.id === fallback)) return fallback;
  if (companies.length === 1) return companies[0].id;
  throw new Error("Select the worker's branch / company before saving.");
}

/** Import blanks are omissions, not instructions to reset salary, status or dates. */
export function employeeImportPatch(payload: Partial<import("@/lib/types").Employee>, supplied: Record<string, string>): Partial<import("@/lib/types").Employee> {
  const aliases: Record<string, string> = { workPermitExpiryDate: "workPermitExpiry" };
  return Object.fromEntries(Object.entries(payload).filter(([key, value]) => key !== "companyId" && value !== undefined && value !== "" && value !== "-" && (supplied[aliases[key] ?? key] ?? "").trim() !== ""));
}