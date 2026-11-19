import { describe, expect, it } from "bun:test";
import { claimSalaryRows, eligibleClaimSummaries } from "./claim-workflow";
import { NO_COMPANY, type CompanyClaimSummary } from "./company-claim-summary";
import type { Employee, PayrollEntry } from "@/lib/types";

const summary = (companyId: string): CompanyClaimSummary => ({ companyId, companyName: companyId, companyCode: companyId, sheets: [], projects: [], workers: [{ key: `e-${companyId}`, code: companyId, name: companyId, projects: [{ key: "site", label: "site", bDays: 2, sundays: 0, normalHours: 16, otHours: 5 }] }] });
const summaries = [summary("BSM"), summary("VRL"), summary(NO_COMPANY)];
const employees = [{ id: "e-BSM", employeeCode: "BSM", companyId: "BSM" }] as Employee[];
const payroll = [{ id: "p", employeeId: "e-BSM", month: "2026-10", basicSalary: 2600, overtimePay: 50, deductions: 200, netPay: 2450, status: "Draft" }] as PayrollEntry[];

describe("claim salary workflow", () => {
  it("combines every assigned company and excludes unresolved claims", () => {
    expect(eligibleClaimSummaries(summaries).map(s => s.companyId)).toEqual(["BSM", "VRL"]);
  });
  it("salary includes workers from all company summaries and preserves saved pay", () => {
    const rows = claimSalaryRows(summaries, employees, payroll, "2026-10");
    expect(rows.map(r => [r.Company, r["G hours"], r["OT hours"]])).toEqual([["BSM", 16, 5], ["VRL", 16, 5]]);
    expect(rows[0]?.["Net pay (SGD)"]).toBe(2450);
    expect(rows[0]?.["Deductions (SGD)"]).toBe(200);
    expect(rows[1]?.["Net pay (SGD)"]).toBeNull();
  });
  it("other-month, rejected and duplicate payroll never become a salary", () => {
    expect(claimSalaryRows(summaries, employees, payroll, "2026-11")[0]?.["Net pay (SGD)"]).toBeNull();
    expect(claimSalaryRows(summaries, employees, [{ ...payroll[0], status: "Rejected" } as PayrollEntry], "2026-10")[0]?.["Net pay (SGD)"]).toBeNull();
    expect(claimSalaryRows(summaries, employees, [...payroll, ...payroll], "2026-10")[0]?.Status).toBe("Multiple payroll entries");
  });
});