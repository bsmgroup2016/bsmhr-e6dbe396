import { onboardingIncomplete } from "@/core/onboarding";

/**
 * Splits people into site workforce (Construction) and office staff (HR,
 * Accounts, QS, IT, Admin, others). Department is the primary signal;
 * designation is the fallback when department is missing or unexpected.
 */

export const STAFF_DEPARTMENTS = ["HR", "Accounts", "QS", "IT", "Admin", "Others"];

export const SITE_DEPARTMENTS = ["Construction"];

export const SITE_DESIGNATIONS = [
  "General Worker",
  "Rigal Signal",
  "Rigger Signal",
  "Welder",
  "ForkLift Operator",
  "Forklift Operator",
  "Lifting Supervisor",
  "Site Supervisor",
  "Electrician",
  "Plumber",
  "Rebar Man",
];

export const STAFF_DESIGNATIONS = [
  "Director",
  "Manager",
  "IT",
  "Engineer",
  "QS",
  "Accounts Head",
  "Accounts Executive",
  "Accounts Assistant",
  "HR Head",
  "HR Assistant",
  "HR Executive",
  "HR Operation",
  "Driver",
];

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();
const has = (list: string[], v?: string | null) =>
  list.some((x) => x.toLowerCase() === norm(v));

/** `trade` is the employee designation column. */
type Person = { department?: string | null; trade?: string | null };
type WorkerRecord = Person & { companyId?: string | null; internalNotes?: string };

/**
 * Department is authoritative (Construction always belongs to the worker
 * roster, HR / Accounts / QS / IT / Admin / Others to office staff);
 * designation is the fallback when the department is missing or unknown.
 */
export function isSiteWorker(p: Person): boolean {
  if (has(SITE_DEPARTMENTS, p.department)) return true;
  if (has(STAFF_DEPARTMENTS, p.department)) return false;
  if (has(SITE_DESIGNATIONS, p.trade)) return true;
  if (has(STAFF_DESIGNATIONS, p.trade)) return false;
  return false;
}

/** Shared population rule for every worker count and worker-only screen. */
export function isCountableWorker(p: WorkerRecord): boolean {
  return Boolean(p.companyId) && isSiteWorker(p) && !onboardingIncomplete(p);
}

/** True for office / administrative staff (everyone not on site). */
export function isOfficeStaff(p: Person): boolean {
  return !isSiteWorker(p);
}

/**
 * Staff carry a numeric Employee ID (1000, 1001 …); site workers carry a
 * branch-prefixed P-File Number (BS-01, V-02 …).
 */
export function idLabel(p: Person): string {
  return isOfficeStaff(p) ? "Employee ID" : "P-File Number";
}

/** Staff are on a fixed monthly salary; workers on an hourly basic rate. */
export function payLabel(p: Person): string {
  return isOfficeStaff(p) ? "Fixed Salary" : "Basic Rate";
}

/** Drivers are staff whose designation (or worker category) is Driver. */
export function isDriver(p: Person & { workerCategory?: string | null }): boolean {
  return norm(p.trade) === "driver" || norm(p.workerCategory) === "driver";
}
