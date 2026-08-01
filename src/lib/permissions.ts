export type AppAuthRole =
  | "admin"
  | "manager"
  | "hr"
  | "supervisor"
  | "client_user"
  | "employee";

export const ROLE_LABELS: Record<AppAuthRole, string> = {
  admin: "Admin — full control",
  manager: "Manager — operations & finance",
  hr: "HR — full workforce access",
  supervisor: "Supervisor — site & workforce",
  client_user: "Client user — limited view",
  employee: "Employee — own portal only",
};

/** Routes any signed-in account can open, even with no role assigned yet. */
export const OPEN_ROUTES = ["/", "/my-portal"];

/**
 * Route -> roles allowed to open it.
 * Admin always passes. HR gets everything except account/system administration.
 */
const STAFF: AppAuthRole[] = ["admin", "manager", "hr", "supervisor"];
const BACK_OFFICE: AppAuthRole[] = ["admin", "manager", "hr"];

export const ROUTE_ROLES: Record<string, AppAuthRole[]> = {
  "/alerts": STAFF,
  "/companies": BACK_OFFICE,
  "/workforce": STAFF,
  "/staff-management": BACK_OFFICE,
  "/staff-attendance": BACK_OFFICE,
  "/staff-payroll": BACK_OFFICE,
  "/documents": STAFF,
  "/compliance": STAFF,
  "/time-management": STAFF,
  "/leave": STAFF,
  "/payroll": BACK_OFFICE,
  "/clients": BACK_OFFICE,
  "/projects": STAFF,
  "/operations": STAFF,
  "/recruitment": BACK_OFFICE,
  "/crm": ["admin", "manager"],
  "/billing": ["admin", "manager"],
  "/finance": ["admin", "manager"],
  "/accommodation": BACK_OFFICE,
  "/transport": BACK_OFFICE,
  "/assets": STAFF,
  "/inventory": STAFF,
  "/approvals": BACK_OFFICE,
  "/reports": BACK_OFFICE,
  "/users": ["admin"],
  "/audit-logs": ["admin"],
  "/settings": ["admin"],
};

export function canAccess(path: string, roles: string[]): boolean {
  if (roles.includes("admin")) return true;
  if (OPEN_ROUTES.includes(path)) return true;
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
