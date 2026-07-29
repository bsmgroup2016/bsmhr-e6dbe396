export type AppAuthRole = "admin" | "manager" | "supervisor" | "client_user";

/**
 * Route -> roles allowed to open it.
 * A route missing from this map is open to any authenticated user.
 * Admin always passes.
 */
export const ROUTE_ROLES: Record<string, AppAuthRole[]> = {
  "/": ["admin", "manager", "supervisor", "client_user"],
  "/companies": ["admin", "manager"],
  "/workforce": ["admin", "manager", "supervisor"],
  "/documents": ["admin", "manager", "supervisor"],
  "/compliance": ["admin", "manager", "supervisor"],
  "/time-management": ["admin", "manager", "supervisor"],
  "/leave": ["admin", "manager", "supervisor"],
  "/payroll": ["admin", "manager"],
  "/clients": ["admin", "manager"],
  "/projects": ["admin", "manager", "supervisor"],
  "/operations": ["admin", "manager", "supervisor"],
  "/recruitment": ["admin", "manager"],
  "/crm": ["admin", "manager"],
  "/billing": ["admin", "manager"],
  "/finance": ["admin"],
  "/accommodation": ["admin", "manager"],
  "/transport": ["admin", "manager"],
  "/assets": ["admin", "manager", "supervisor"],
  "/approvals": ["admin", "manager"],
  "/reports": ["admin", "manager"],
  "/users": ["admin"],
  "/audit-logs": ["admin"],
  "/settings": ["admin"],
};

export function canAccess(path: string, roles: string[]): boolean {
  if (roles.includes("admin")) return true;
  // Match the most specific configured route prefix (e.g. /workforce/<id> -> /workforce).
  const key =
    ROUTE_ROLES[path] !== undefined
      ? path
      : Object.keys(ROUTE_ROLES)
          .filter((r) => r !== "/" && path.startsWith(`${r}/`))
          .sort((a, b) => b.length - a.length)[0];
  const allowed = key ? ROUTE_ROLES[key] : undefined;
  if (!allowed) return true;
  return roles.some((r) => allowed.includes(r as AppAuthRole));
}
