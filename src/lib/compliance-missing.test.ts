import { describe, expect, test } from "bun:test";
import { buildComplianceItems, missingComplianceRecords } from "./compliance";
import type { Employee } from "./types";

const worker = (over: Partial<Employee>) =>
  ({ id: "1", name: "A", employeeCode: "P-1", passType: "Work Permit", passExpiry: "-", status: "Active", ...over }) as Employee;

describe("MOM compliance", () => {
  test("foreign worker with no dates lists every missing record", () => {
    expect(missingComplianceRecords([worker({})])[0].missing).toEqual([
      "Work pass expiry", "Passport expiry", "Medical insurance", "CSOC / safety course",
    ]);
  });
  test("Singaporean/PR workers are not flagged", () => {
    expect(missingComplianceRecords([worker({ passType: "Singaporean/PR" })])).toHaveLength(0);
  });
  test("medical insurance expiry is tracked", () => {
    const items = buildComplianceItems([worker({ medicalInsuranceExpiry: "2030-01-01" })], []);
    expect(items.some((i) => i.category === "Medical")).toBe(true);
  });
});
