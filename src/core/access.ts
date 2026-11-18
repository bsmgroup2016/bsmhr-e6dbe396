export const AUTH_ROLES = ["admin", "manager", "hr", "supervisor", "driver", "accounts", "it", "client_user", "employee"] as const;
export type AppAuthRole = (typeof AUTH_ROLES)[number];

export const ROLE_LABELS: Record<AppAuthRole, string> = {
  admin: "Admin — full control",
  manager: "Manager — operations & finance",
  hr: "HR — workforce & payroll",
  supervisor: "Supervisor — site & workforce",
  driver: "Driver — own attendance & payslips",
  accounts: "Accounts — billing, finance & payroll",
  it: "IT — audit logs & own portal",
  client_user: "Client user — own portal",
  employee: "Employee — own portal",
};

const STAFF: AppAuthRole[] = ["admin", "manager", "hr", "supervisor"];
const BACK_OFFICE: AppAuthRole[] = ["admin", "manager", "hr"];
const FINANCE: AppAuthRole[] = ["admin", "manager", "accounts"];
const PAYROLL: AppAuthRole[] = [...BACK_OFFICE, "accounts"];
export const OPEN_ROUTES = ["/", "/dashboard"];
export const ROUTE_ROLES: Record<string, readonly AppAuthRole[]> = {
  "/my-portal": AUTH_ROLES,
  "/qr-punch": AUTH_ROLES,
  "/alerts": STAFF,
  "/companies": BACK_OFFICE,
  "/workforce": STAFF,
  "/staff-management": BACK_OFFICE,
  "/staff-attendance": BACK_OFFICE,
  "/staff-payroll": PAYROLL,
  "/drivers": BACK_OFFICE,
  "/driver-duty": STAFF,
  "/driver-dispatch": STAFF,
  "/driver-compliance": BACK_OFFICE,
  "/documents": STAFF,
  "/compliance": STAFF,
  "/mom": BACK_OFFICE,
  "/training": STAFF,
  "/time-management": STAFF,
  "/time-cards": PAYROLL,
  "/claim-generator": PAYROLL,
  "/claim-workflow": PAYROLL,
  "/leave": STAFF,
  "/payroll": PAYROLL,
  "/clients": [...BACK_OFFICE, "accounts"],
  "/quotations": FINANCE,
  "/projects": STAFF,
  "/operations": STAFF,
  "/deployed-workers": STAFF,
  "/available-workers": STAFF,
  "/deployment-history": STAFF,
  "/recruitment": BACK_OFFICE,
  "/crm": ["admin", "manager"],
  "/contracts": FINANCE,
  "/billing": FINANCE,
  "/finance": FINANCE,
  "/accommodation": BACK_OFFICE,
  "/transport": BACK_OFFICE,
  "/assets": STAFF,
  "/inventory": STAFF,
  "/approvals": BACK_OFFICE,
  "/reports": [...BACK_OFFICE, "accounts"],
  "/assistant": ["admin"],
  "/users": ["admin"],
  "/audit-logs": ["admin", "it"],
  "/settings": ["admin"],
};

export function hasAssignedRole(roles: readonly string[]): boolean {
  return roles.some((role) => AUTH_ROLES.some((known) => known === role));
}

export function canAccess(path: string, roles: readonly string[]): boolean {
  const normalized = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (roles.includes("admin")) return true;
  if (OPEN_ROUTES.includes(normalized)) return true;
  const key = ROUTE_ROLES[normalized] ? normalized : Object.keys(ROUTE_ROLES)
    .filter((route) => normalized.startsWith(`${route}/`))
    .sort((a, b) => b.length - a.length)[0];
  const allowed = key ? ROUTE_ROLES[key] : undefined;
  return allowed ? roles.some((role) => allowed.some((known) => known === role)) : false;
}
/** True when the account only has the worker self-service role (lands on My Portal, no office menus). */
export function isWorkerOnly(roles: readonly string[]): boolean {
  return roles.length > 0 && roles.every((role) => role === "employee");
}
