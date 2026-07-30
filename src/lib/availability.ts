import type { Employee } from "@/lib/types";

/**
 * Shared "available worker" definition used by the dashboard and the
 * workforce page so both always show the same count.
 * A worker is available when they are not assigned to an active/approved
 * project, not blocked/deployed, and their record is Active / On Leave.
 */
export function isEmployeeAvailable(e: Employee, assignedIds: Set<string>) {
  const deploy = e.deploymentStatus ?? "Available";
  return (
    !assignedIds.has(e.id) &&
    deploy !== "Blocked" &&
    deploy !== "Not Deployable" &&
    deploy !== "Deployed" &&
    (e.status === "Active" || e.status === "On Leave")
  );
}

export function activeAssignedEmployeeIds(
  assignments: Array<{ employeeId: string; status: string }>,
) {
  return new Set(
    assignments.filter((a) => a.status === "Active" || a.status === "Approved").map((a) => a.employeeId),
  );
}
