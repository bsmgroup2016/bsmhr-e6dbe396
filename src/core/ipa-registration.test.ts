import { expect, test } from "bun:test";
import { ipaEmployeeDefaults } from "./ipa-registration";

test("IPA dates never become work-permit expiry or joining dates", () => {
  const values = ipaEmployeeDefaults({ applicationDate: "2024-10-10", ipaIssueDate: "2024-10-14", ipaExpiryDate: "2025-01-10" }, "r2://ipa/sample.pdf");
  expect(values.applicationDate).toBe("2024-10-10");
  expect(values.ipaExpiryDate).toBe("2025-01-10");
  expect(values.passExpiry).toBeUndefined();
  expect(values.workPermitIssueDate).toBeUndefined();
  expect(values.joinedOn).toBeUndefined();
});
test("IPA sample salary and weekly hours retain distinct meanings and printed zero", () => {
  const values = ipaEmployeeDefaults({ declaredSalary: 400, fixedAllowance: 0, otRate: 3.15, levyRate: 650, normalHoursPerWeek: 44, workingDaysPerWeek: 6, dailyRestDayRate: 15.38, housingDeduction: 0 }, "r2://ipa/sample.pdf");
  expect(values.declaredSalary).toBe(400);
  expect(values.fixedAllowance).toBe(0);
  expect(values.otRate).toBe(3.15);
  expect(values.levyRate).toBe(650);
  expect(values.basicSalary).toBeUndefined();
  expect(values.normalHours).toBeUndefined();
  expect(values.internalNotes).toContain("Normal hours per week (excluding breaks): 44");
  expect(values.internalNotes).toContain("Daily rest-day/public-holiday rate (SGD): 15.38");
  expect(values.internalNotes).toContain("Monthly housing deduction (SGD): 0");
});
test("IPA source and all extra particulars remain attached without guessing a company", () => {
  const values = ipaEmployeeDefaults({ name: "MD ABU SAYED", fin: "M3536410W", occupation: "PROCESS MAINTENANCE & CONSTRUCTION WORKER", additionalDetails: [{ label: "Agency licence", value: "22C1248", page: 14 }] }, "r2://ipa/sample.pdf");
  expect(values.name).toBe("MD ABU SAYED");
  expect(values.fin).toBe("M3536410W");
  expect(values.trade).toBe("PROCESS MAINTENANCE & CONSTRUCTION WORKER");
  expect(values.ipaDocumentUrl).toBe("r2://ipa/sample.pdf");
  expect(values.companyId).toBeUndefined();
  expect(values.internalNotes).toContain("Agency licence (page 14): 22C1248");
});