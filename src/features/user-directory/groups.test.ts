import { describe, expect, test } from "bun:test";
import { accountGroup, displayRole } from "./groups";

describe("User directory account lists", () => {
  test("worker app accounts are separate from office accounts", () => {
    expect(accountGroup(["employee"])).toBe("workers");
    expect(accountGroup(["admin"])).toBe("staff");
    expect(accountGroup(["hr"])).toBe("staff");
    expect(accountGroup(["manager"])).toBe("staff");
    expect(accountGroup(["driver"])).toBe("staff");
    expect(accountGroup(["accounts"])).toBe("staff");
    expect(accountGroup(["it"])).toBe("staff");
    expect(accountGroup(["supervisor"])).toBe("staff");
    expect(accountGroup(["client_user"])).toBe("staff");
  });
  test("ordinary signup stays in awaiting assignment, not worker apps", () => {
    expect(accountGroup([])).toBe("unassigned");
    expect(displayRole([])).toBeNull();
  });
  test("mixed-role staff stay in office list regardless of database row order", () => {
    expect(accountGroup(["employee", "admin"])).toBe("staff");
    expect(accountGroup(["admin", "employee"])).toBe("staff");
    expect(displayRole(["employee", "admin"])).toBe("admin");
  });
});