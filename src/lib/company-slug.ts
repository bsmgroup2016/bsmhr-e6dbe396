import type { Company } from "@/lib/types";

/** URL-safe slug for a company, e.g. "BSM Engineering" -> "bsm-engineering". */
export function companySlug(company: Pick<Company, "code" | "name">): string {
  const base = (company.code || company.name || "").trim();
  return (
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "company"
  );
}

/** Resolve a company from a URL segment: slug, code or raw id. */
export function findCompanyByParam<T extends Company>(companies: T[], param: string): T | undefined {
  const key = decodeURIComponent(param).toLowerCase();
  return (
    companies.find((c) => companySlug(c) === key) ||
    companies.find((c) => (c.code || "").toLowerCase() === key) ||
    companies.find((c) => c.id === param)
  );
}
