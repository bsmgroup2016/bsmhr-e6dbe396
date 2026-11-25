import type { Employee } from "@/lib/types";
import { onboardingIncomplete } from "@/core/onboarding";

/** Work permit / pass expired (or expiring today) — worker cannot be deployed. */
export function hasExpiredWorkPermit(e: Employee) {
  const expiry = e.workPermitExpiryDate;
  if (!expiry) return false;
  const t = new Date(`${expiry}T23:59:59+08:00`).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

/**
 * Shared "available worker" definition used by the dashboard and the
 * workforce page so both always show the same count.
 * A worker is available when they are not assigned to an active/approved
 * project, not blocked/deployed, not on leave, their work permit is valid,
 * and their record is Active.
 */
export function isEmployeeAvailable(e: Employee, assignedIds: Set<string>) {
  const deploy = e.deploymentStatus ?? "Available";
  return (
    !onboardingIncomplete(e) &&
    !assignedIds.has(e.id) &&
    deploy !== "Blocked" &&
    deploy !== "Not Deployable" &&
    deploy !== "Deployed" &&
    deploy !== "On Leave" &&
    e.status === "Active" &&
    !hasExpiredWorkPermit(e)
  );
}

/**
 * Company-card workforce bands: live workers, currently working
 * (live minus available) and available for deployment.
 */
export function workforceBands(workers: Employee[], assignedIds: Set<string>) {
  const live = workers.length;
  const available = workers.filter((e) => isEmployeeAvailable(e, assignedIds)).length;
  return { live, working: live - available, available };
}

export function activeAssignedEmployeeIds(
  assignments: Array<{ employeeId: string; status: string }>,
) {
  return new Set(
    assignments.filter((a) => a.status === "Active" || a.status === "Approved").map((a) => a.employeeId),
  );
}
