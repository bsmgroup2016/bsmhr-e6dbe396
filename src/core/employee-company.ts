import type { Company } from "@/lib/types";

const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

/** The selected branch determines the employee's company; global filters cannot override it. */
export function employeeCompanyId(branch: string | undefined, companies: Company[], fallback?: string): string {
  const matches = branch ? companies.filter(company => [company.name, company.legalName, company.code].some(name => name && normalize(name) === normalize(branch))) : [];
  if (matches.length === 1) return matches[0].id;
  if (branch) throw new Error("The selected branch does not match a company. Check the branch / company before saving.");
  if (fallback && companies.some(company => company.id === fallback)) return fallback;
  if (companies.length === 1) return companies[0].id;
  throw new Error("Select the worker's branch / company before saving.");
}

/** Import blanks are omissions, not instructions to reset salary, status or dates. */
export function employeeImportPatch(payload: Partial<import("@/lib/types").Employee>, supplied: Record<string, string>): Partial<import("@/lib/types").Employee> {
  const aliases: Record<string, string> = { workPermitExpiryDate: "workPermitExpiry" };
  return Object.fromEntries(Object.entries(payload).filter(([key, value]) => key !== "companyId" && value !== undefined && value !== "" && value !== "-" && (supplied[aliases[key] ?? key] ?? "").trim() !== ""));
}