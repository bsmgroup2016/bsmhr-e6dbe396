import { describe, expect, test } from "bun:test";
import { AUTH_ROLES, ROUTE_ROLES, canAccess, hasAssignedRole } from "./access";

describe("Account role access", () => {
  test("ordinary signup has welcome-only access", () => {
    expect(hasAssignedRole([])).toBe(false);
    expect(canAccess("/", [])).toBe(true);
    for (const path of Object.keys(ROUTE_ROLES)) expect(canAccess(path, [])).toBe(false);
  });
  test("HR can open workforce but cannot administer accounts", () => {
    expect(canAccess("/workforce", ["hr"])).toBe(true);
    expect(canAccess("/users", ["hr"])).toBe(false);
  });
  test("manager can open deployments", () => expect(canAccess("/operations", ["manager"])).toBe(true));
  test("driver can open own portal but not group payroll or dispatch management", () => {
    expect(canAccess("/my-portal", ["driver"])).toBe(true);
    expect(canAccess("/payroll", ["driver"])).toBe(false);
    expect(canAccess("/driver-dispatch", ["driver"])).toBe(false);
  });
  test("accounts has finance access without HR or administration", () => {
    expect(canAccess("/billing", ["accounts"])).toBe(true);
    expect(canAccess("/finance", ["accounts"])).toBe(true);
    expect(canAccess("/workforce", ["accounts"])).toBe(false);
    expect(canAccess("/settings", ["accounts"])).toBe(false);
  });
  test("IT has audit access without payroll", () => {
    expect(canAccess("/audit-logs", ["it"])).toBe(true);
    expect(canAccess("/payroll", ["it"])).toBe(false);
  });
  test("only admin can assign roles", () => {
    for (const role of AUTH_ROLES) expect(canAccess("/users", [role])).toBe(role === "admin");
  });
  test("unknown routes and roles fail closed", () => {
    expect(canAccess("/unlisted", ["hr"])).toBe(false);
    expect(hasAssignedRole(["unknown"])).toBe(false);
    expect(canAccess("/workforce/123", ["accounts"])).toBe(false);
  });
});