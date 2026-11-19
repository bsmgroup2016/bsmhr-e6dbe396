import { describe, expect, it } from "bun:test";
import { claimCompanyCards, claimSalaryRows, eligibleClaimSummaries } from "./claim-workflow";
import { NO_COMPANY, type CompanyClaimSummary } from "./company-claim-summary";
import type { Company, Employee, PayrollEntry } from "@/lib/types";

const summary = (companyId: string): CompanyClaimSummary => ({ companyId, companyName: companyId, companyCode: companyId, sheets: [], projects: [], workers: [{ key: `e-${companyId}`, code: companyId, name: companyId, projects: [{ key: "site", label: "site", bDays: 2, sundays: 0, normalHours: 16, otHours: 5 }] }] });
const summaries = [summary("BSM"), summary("VRL"), summary(NO_COMPANY)];
const employees = [{ id: "e-BSM", employeeCode: "BSM", companyId: "BSM" }] as Employee[];
const payroll = [{ id: "p", employeeId: "e-BSM", month: "2026-10", basicSalary: 2600, overtimePay: 50, deductions: 200, netPay: 2450, status: "Draft" }] as PayrollEntry[];

describe("claim salary workflow", () => {
  it("shows BSM, VRL and Pluto even when only VRL has claims", () => {
    const companies = ["PLUTO", "VRL", "BSM"].map(code => ({ id: code, code, name: code })) as Company[];
    const cards = claimCompanyCards([summary("VRL")], companies);
    expect(cards.map(card => card.companyId)).toEqual(["BSM", "VRL", "PLUTO"]);
    expect(cards.map(card => card.workers.length)).toEqual([0, 1, 0]);
    expect(cards.reduce((n, card) => n + card.workers.reduce((v, worker) => v + worker.projects.reduce((h, p) => h + p.normalHours, 0), 0), 0)).toBe(16);
  });
  it("automatically includes a newly registered company without inventing claims", () => {
    const companies = ["BSM", "VRL", "PLUTO", "NEW"].map(code => ({ id: code, code, name: code })) as Company[];
    expect(claimCompanyCards([], companies).map(card => [card.companyId, card.sheets.length])).toEqual([["BSM", 0], ["VRL", 0], ["PLUTO", 0], ["NEW", 0]]);
  });
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