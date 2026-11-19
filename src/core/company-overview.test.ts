import { describe, expect, it } from "bun:test";
import { companyOverview, orderedCompanies } from "./company-overview";
import type { Company, Employee, PayrollEntry } from "../lib/types";

const employee = (id: string, companyId: string, values: Partial<Employee> = {}) => ({ id, companyId, department: "Construction", passType: "Work Permit", wpStage: "Active", ...values } as Employee);
const now = new Date("2026-11-19T06:21:00Z");
describe("company overview", () => {
  it("includes newly added companies after BSM, VRL and Pluto", () => {
    const companies = ["NEW", "PLUTO", "VRL", "BSM"].map((code) => ({ id: code, code, name: code }) as Company);
    expect(orderedCompanies(companies).map((c) => c.code)).toEqual(["BSM", "VRL", "PLUTO", "NEW"]);
  });
  it("aggregates group totals and isolates each company", () => {
    const employees = [employee("a", "bsm", { wpStage: "Medical Cleared" }), employee("b", "vrl", { wpStage: "Arrived" })];
    expect(companyOverview(employees, [], [], undefined, now).waiting.length).toBe(2);
    expect(companyOverview(employees, [], [], "bsm", now).waiting.map((e) => e.id)).toEqual(["a"]);
  });
  it("counts only pre-card Work Permit stages as waiting for issuance", () => {
    const employees = ["IPA Issued", "Arrived", "Medical Cleared", "Card Issued", "Active", "Cancelled"].map((wpStage, i) => employee(String(i), "bsm", { wpStage: wpStage as Employee["wpStage"] }));
    expect(companyOverview(employees, [], [], "bsm", now).waiting.length).toBe(3);
  });
  it("counts confirmed permits within 60 days, never estimates, expired dates or other passes", () => {
    const employees = [employee("a", "bsm", { passExpiry: "2027-01-18" }), employee("b", "bsm", { passExpiry: "2027-01-19" }), employee("c", "bsm", { passExpiry: "2026-11-18" }), employee("d", "bsm", { passExpiry: "2026-12-01", passType: "S Pass" }), employee("e", "bsm", { passExpiry: "-", workPermitIssueDate: "2025-12-01" })];
    expect(companyOverview(employees, [], [], "bsm", now).permits.map((e) => e.id)).toEqual(["a"]);
  });
  it("deduplicates CSOC employee and certificate records", () => {
    const employees = [employee("a", "bsm", { safetyCourseType: "CSOC", safetyCourseExpiry: "2026-12-01" }), employee("b", "vrl")];
    const certs = [{ id: "1", employeeId: "a", courseName: "CSOC", expiryDate: "2026-12-01" }, { id: "2", employeeId: "b", courseName: "CSOC", expiryDate: "2026-12-01" }];
    expect(companyOverview(employees, certs, [], "bsm", now).csoc.length).toBe(1);
  });
  it("counts confirmed passport expiries through 90 days and scopes company totals", () => {
    const employees = [employee("a", "bsm", { passportExpiry: "2027-02-17" }), employee("b", "bsm", { passportExpiry: "2027-02-18" }), employee("c", "bsm", { passportExpiry: "2026-11-18" }), employee("d", "vrl", { passportExpiry: "2026-11-19" }), employee("e", "bsm", { passportExpiry: "-" })];
    expect(companyOverview(employees, [], [], "bsm", now).passports.map((e) => e.id)).toEqual(["a"]);
    expect(companyOverview(employees, [], [], undefined, now).passports.map((e) => e.id)).toEqual(["a", "d"]);
  });
  it("sums current-year recorded gross wages once, including bonus, not deductions or rejected rows", () => {
    const employees = [employee("a", "bsm"), employee("b", "vrl")];
    const pay = (employeeId: string, month: string, status = "Paid") => ({ employeeId, month, basicSalary: 2600, overtimePay: 100, allowances: 50, bonus: 250, deductions: 200, status }) as PayrollEntry;
    const payroll = [pay("a", "2026-11"), pay("b", "2026-11"), pay("a", "2025-11"), pay("a", "2026-10", "Rejected")];
    expect(companyOverview(employees, [], payroll, "bsm", now).annualWages).toBe(3000);
    expect(companyOverview(employees, [], payroll, undefined, now).annualWages).toBe(6000);
  });
});