/**
 * MOM residential address (housing) notification.
 *
 * Employers must update a work pass holder's residential address with MOM
 * (WP Online / OFWAS "Update Address") within 5 days of the worker moving.
 * This module derives which workers are out of sync between their bed
 * allocation and the address recorded on their pass, and builds the bulk
 * upload rows for submission.
 */
import type { Employee, BedAllocation, Dormitory } from "@/lib/types";

/** Passes that MOM requires an address notification for. */
const NOTIFIABLE_PASSES = ["Work Permit", "S Pass", "Employment Pass"];

/** MOM deadline: address change must be reported within 5 days. */
export const ADDRESS_NOTICE_DAYS = 5;

const norm = (s?: string) => (s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

const daysSince = (iso?: string) => {
  if (!iso) return 0;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86_400_000);
};

export interface HousingSyncRow {
  employee: Employee;
  dormitory?: Dormitory;
  allocation?: BedAllocation;
  /** Address currently declared to MOM (stored on the employee record). */
  declaredAddress: string;
  /** Address implied by the active bed allocation. */
  actualAddress: string;
  /** Date the worker moved in (drives the 5-day clock). */
  effectiveDate: string;
  daysElapsed: number;
  status: "Synced" | "Pending" | "Overdue" | "No allocation";
}

/** Compare every notifiable worker's pass address against their live allocation. */
export function housingSync(
  employees: Employee[],
  allocations: BedAllocation[],
  dormitories: Dormitory[],
): HousingSyncRow[] {
  const dormById = new Map(dormitories.map((d) => [d.id, d]));
  const activeByEmp = new Map<string, BedAllocation>();
  for (const a of allocations) {
    if (a.status === "Vacated") continue;
    const prev = activeByEmp.get(a.employeeId);
    if (!prev || (a.checkInDate ?? "") > (prev.checkInDate ?? "")) activeByEmp.set(a.employeeId, a);
  }

  return employees
    .filter((e) => NOTIFIABLE_PASSES.includes(e.passType) && e.status === "Active")
    .map((e) => {
      const allocation = activeByEmp.get(e.id);
      const dormitory = allocation ? dormById.get(allocation.dormitoryId) : undefined;
      const actualAddress = dormitory
        ? [dormitory.address, allocation?.roomNo ? `Room ${allocation.roomNo}` : ""].filter(Boolean).join(", ")
        : "";
      const declaredAddress = e.dormitoryAddress ?? e.address ?? "";
      const effectiveDate = allocation?.checkInDate ?? "";
      const elapsed = daysSince(effectiveDate);

      let status: HousingSyncRow["status"];
      if (!allocation) status = "No allocation";
      else if (norm(declaredAddress) === norm(actualAddress)) status = "Synced";
      else status = elapsed > ADDRESS_NOTICE_DAYS ? "Overdue" : "Pending";

      return {
        employee: e,
        dormitory,
        allocation,
        declaredAddress,
        actualAddress,
        effectiveDate,
        daysElapsed: elapsed,
        status,
      };
    })
    .sort((a, b) => {
      const rank = { Overdue: 0, Pending: 1, "No allocation": 2, Synced: 3 } as const;
      return rank[a.status] - rank[b.status] || b.daysElapsed - a.daysElapsed;
    });
}

/** MOM bulk "Update Residential Address" upload rows for the pending workers. */
export function housingNotificationRows(rows: HousingSyncRow[]) {
  return rows
    .filter((r) => r.status === "Pending" || r.status === "Overdue")
    .map((r) => ({
      "FIN": r.employee.fin ?? "",
      "Work Permit No": r.employee.workPermitNumber ?? "",
      "Worker Name": r.employee.name,
      "Pass Type": r.employee.passType,
      "Nationality": r.employee.nationality ?? "",
      "Housing Type": r.dormitory?.name ? "Dormitory" : "Other",
      "Dormitory / Premise Name": r.dormitory?.name ?? "",
      "Residential Address": r.actualAddress,
      "Postal Code": r.employee.postalCode ?? "",
      "Room No": r.allocation?.roomNo ?? "",
      "Effective Date": r.effectiveDate,
      "Previous Address": r.declaredAddress,
      "Days Since Move": r.daysElapsed,
      "Submission Status": r.status === "Overdue" ? "LATE — submit immediately" : "Within 5-day window",
    }));
}

export function housingSummary(rows: HousingSyncRow[]) {
  return {
    total: rows.length,
    synced: rows.filter((r) => r.status === "Synced").length,
    pending: rows.filter((r) => r.status === "Pending").length,
    overdue: rows.filter((r) => r.status === "Overdue").length,
    unallocated: rows.filter((r) => r.status === "No allocation").length,
  };
}
