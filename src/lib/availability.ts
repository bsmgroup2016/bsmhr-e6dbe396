import type { Employee } from "@/lib/types";
import { onboardingIncomplete } from "@/core/onboarding";
import { dailyState, onLeaveIds, singaporeParts, type DailyState } from "@/core/daily-availability";

/** Today's attendance/leave facts for the noon availability rule. */
export type DailyContext = { stateOf: (employeeId: string) => DailyState };

export function dailyContext(
  attendance: Array<{ employeeId: string; date: string; checkIn?: string | null; status?: string }>,
  leave: Array<{ employeeId: string; startDate: string; endDate: string; status: string }>,
  now = new Date(),
): DailyContext {
  const { date } = singaporeParts(now);
  const present = new Set(attendance.filter((a) => a.date === date && (a.checkIn || a.status === "Present")).map((a) => a.employeeId));
  const leaveIds = onLeaveIds(leave, date);
  for (const a of attendance) if (a.date === date && /leave|mc|medical/i.test(a.status ?? "")) leaveIds.add(a.employeeId);
  return { stateOf: (id) => dailyState(now, { checkedIn: present.has(id), onLeave: leaveIds.has(id) }) };
}

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
export function isEmployeeAvailable(e: Employee, assignedIds: Set<string>, daily?: DailyContext) {
  const deploy = e.deploymentStatus ?? "Available";
  const day = daily?.stateOf(e.id) ?? "pending";
  if (day === "on_leave" || day === "working" || day === "weekly_off") return false;
  // After 12:00 SGT on a working day with no attendance, the worker is free for the day.
  const freeToday = day === "available_no_attendance";
  return (
    !onboardingIncomplete(e) &&
    (freeToday || !assignedIds.has(e.id)) &&
    deploy !== "Blocked" &&
    deploy !== "Not Deployable" &&
    (freeToday || deploy !== "Deployed") &&
    deploy !== "On Leave" &&
    e.status === "Active" &&
    !hasExpiredWorkPermit(e)
  );
}

/**
 * Company-card workforce bands: live workers, currently working
 * (live minus available) and available for deployment.
 */
export function workforceBands(workers: Employee[], assignedIds: Set<string>, daily?: DailyContext) {
  const live = workers.length;
  const available = workers.filter((e) => isEmployeeAvailable(e, assignedIds, daily)).length;
  // Working = actually on a site (active assignment or marked Deployed); on-leave / not-deployable are neither.
  const working = workers.filter((e) => assignedIds.has(e.id) || e.deploymentStatus === "Deployed" || (e.status as string) === "Deployed").length;
  return { live, working, available };
}

export function activeAssignedEmployeeIds(
  assignments: Array<{ employeeId: string; status: string }>,
) {
  return new Set(
    assignments.filter((a) => a.status === "Active" || a.status === "Approved").map((a) => a.employeeId),
  );
}
