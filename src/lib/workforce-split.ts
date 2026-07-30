/**
 * Splits people into site workforce (Construction) and office staff (HR,
 * Accounts, QS, IT, Admin, others). Department is the primary signal;
 * designation is the fallback when department is missing or unexpected.
 */

export const STAFF_DEPARTMENTS = ["HR", "Accounts", "QS", "IT", "Admin"];

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
];

export const STAFF_DESIGNATIONS = [
  "Director",
  "Manager",
  "IT",
  "Engineer",
  "QS",
  "Accounts Head",
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

/** True for Construction / site trades. */
export function isSiteWorker(p: Person): boolean {
  if (has(SITE_DEPARTMENTS, p.department)) return true;
  if (has(STAFF_DEPARTMENTS, p.department)) return false;
  return has(SITE_DESIGNATIONS, p.trade);
}

/** True for office / administrative staff (everyone not on site). */
export function isOfficeStaff(p: Person): boolean {
  return !isSiteWorker(p);
}
