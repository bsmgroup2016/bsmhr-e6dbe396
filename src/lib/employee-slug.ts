import type { Employee } from "@/lib/types";
import { getEmployees } from "@/lib/store";

/** URL-safe slug from the P-File number, e.g. "BSM-0012" -> "bsm-0012". */
export function employeeSlug(employee: Pick<Employee, "id" | "employeeCode">): string {
  const base = (employee.employeeCode || "").trim();
  const slug = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || employee.id;
}

/** Slug for a known employee id (falls back to the id when not loaded yet). */
export function employeeSlugById(id: string): string {
  const found = getEmployees().find((e) => e.id === id);
  return found ? employeeSlug(found) : id;
}

/** Resolve an employee from a URL segment: P-File slug, raw P-File number or id. */
export function findEmployeeByParam<T extends Pick<Employee, "id" | "employeeCode">>(
  employees: T[],
  param: string,
): T | undefined {
  const key = decodeURIComponent(param).toLowerCase();
  return (
    employees.find((e) => e.id === param) ||
    employees.find((e) => employeeSlug(e) === key) ||
    employees.find((e) => (e.employeeCode || "").toLowerCase() === key)
  );
}