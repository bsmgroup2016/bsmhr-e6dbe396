import type { AppAuthRole } from "@/lib/permissions";

export type AccountGroup = "staff" | "workers" | "unassigned";

// Presentation only: route and data permissions still use the existing guards.
export function accountGroup(roles: readonly AppAuthRole[]): AccountGroup {
  if (roles.some((role) => role !== "employee")) return "staff";
  return roles.includes("employee") ? "workers" : "unassigned";
}

export function displayRole(roles: readonly AppAuthRole[]): AppAuthRole | null {
  return roles.find((role) => role !== "employee") ?? roles[0] ?? null;
}