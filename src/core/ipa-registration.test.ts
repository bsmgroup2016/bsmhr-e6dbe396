import { expect, test } from "bun:test";
import { ipaEmployeeDefaults } from "./ipa-registration";
import { IPA_DETAIL_FIELDS, ipaDetailsFromForm } from "./ipa-detail-fields";
import { fromEmployee, toEmployee } from "@/lib/db";

test("IPA dates never become work-permit expiry or joining dates", () => {
  const values = ipaEmployeeDefaults({ applicationDate: "2024-10-10", ipaIssueDate: "2024-10-14", ipaExpiryDate: "2025-01-10" }, "r2://ipa/sample.pdf");
  expect(values.applicationDate).toBe("2024-10-10");
  expect(values.ipaExpiryDate).toBe("2025-01-10");
  expect(values.passExpiry).toBeUndefined();
  expect(values.workPermitIssueDate).toBeUndefined();
  expect(values.joinedOn).toBeUndefined();
});

const particulars = {
  highestQualification: "Secondary 2", fatherName: "MD ANIS LAMI", motherName: "MST NASIMA BEGUM", criminalRecord: "No",
  industry: "Process", occupationCode: "81509C", housingProvided: "Yes",
  basicMonthlySalary: 400, housingDeduction: 0, otherDeduction: 0, monthlySalaryAfterDeductions: 400,
  normalHoursPerWeek: 44, workingDaysPerWeek: 6, dailyRestDayRate: 15.38,
  agencyName: "DIRECTION OVERSEAS PTE. LTD.", agencyLicence: "22C1248",
  agencyAddress: "5 Soon Lee Street, #04-38 Pioneer Point, Singapore 627607", agencyPhone: "8471 8667",
  agencyFee: 200, overseasCosts: 0, employeePaidFees: "Yes",
  countryOfBirth: "BANGLADESH", raceAsDeclared: "BANGLADESHI", previouslySingaporeCitizenPr: "No",
  everArrested: "No", everConvicted: "No", addressHistory: "KAKRABUNIA PATUAKHALI SADAR, BAROBARI - 8600, PATUAKHALI; 2003 till present",
  travelDocumentType: "PASSPORT", immigrationStatusAtApplication: "NOT IN SINGAPORE",
  employerName: "PLUTO SYSTEM ENGINEERING PTE. LTD.", employerCpfSubmissionNumber: "201716303C - PTE - 02",
  employerUen: "201716303C", employerBusinessActivity: "PROCESS INDUSTRY MAINTENANCE",
  employerRegisteredAddress: "1 SOON LEE STREET, #06-30 PIONEER CENTRE, SINGAPORE 627605",
  employerCorrespondenceAddress: "5 SOON LEE STREET, #04-49 PIONEER POINT, SINGAPORE 627607",
  employerPhone: "69800555", sbTransmissionReference: "H704255", temporaryPermitUponApproval: "No",
  monthlyHousingAllowance: 0, monthlyTransportAllowance: 0, otherMonthlyAllowances: 0,
  hasFixedMonthlyAllowances: "No", hasFixedMonthlyDeductions: "No", totalFixedMonthlyDeductions: 0, agencyUsed: "Yes",
};
for (const field of IPA_DETAIL_FIELDS) {
  test(`IPA ${field.key} autofills and survives editable form submission`, () => {
    const expected = particulars[field.key];
    const mapped = ipaEmployeeDefaults(particulars, "r2://ipa/sample.pdf");
    expect(mapped[field.key]).toBe(expected);
    const fd = new FormData();
    fd.set(field.key, String(expected));
    expect(ipaDetailsFromForm(fd)[field.key]).toBe(expected);
    const row = toEmployee(ipaDetailsFromForm(fd));
    expect(row[field.column]).toBe(expected);
    expect(fromEmployee(row)[field.key]).toBe(expected);
  });
}
test("IPA employer contacts and historical immigration answers never overwrite worker or CPF fields", () => {
  const mapped = ipaEmployeeDefaults(particulars, "r2://ipa/sample.pdf");
  expect(mapped.employerPhone).toBe("69800555");
  expect(mapped.phone).toBeUndefined();
  expect(mapped.address).toBeUndefined();
  expect(mapped.prStatus).toBeUndefined();
  expect(mapped.ethnicGroup).toBeUndefined();
  expect(mapped.passType).toBeUndefined();
  expect(mapped.employerRegisteredAddress).not.toBe(mapped.employerCorrespondenceAddress);
});
test("separate arrest and conviction answers do not collapse into one another", () => {
  const mapped = ipaEmployeeDefaults({ everArrested: "Yes", everConvicted: "No" }, "r2://ipa/sample.pdf");
  expect(mapped.everArrested).toBe("Yes");
  expect(mapped.everConvicted).toBe("No");
});
test("empty IPA amount remains unknown rather than becoming zero", () => {
  const fd = new FormData();
  fd.set("agencyFee", "");
  expect(ipaDetailsFromForm(fd).agencyFee).toBeUndefined();
  expect(ipaDetailsFromForm(fd).basicMonthlySalary).toBeUndefined();
});
test("IPA monthly basic salary never becomes a worker daily rate, even with an unexpected AI key", () => {
  const extracted = { basicMonthlySalary: 400, declaredSalary: 400, basicSalary: 400, dailyRestDayRate: 15.38 };
  const values = ipaEmployeeDefaults(extracted, "r2://ipa/sample.pdf");
  expect(values.basicMonthlySalary).toBe(400);
  expect(values.basicSalary).toBeUndefined();
  expect(values.dailyRestDayRate).toBe(15.38);
});
test("monthly basic salary and manually entered daily basic rate persist independently", () => {
  const fd = new FormData();
  fd.set("basicMonthlySalary", "400");
  const values = { ...ipaDetailsFromForm(fd), basicSalary: 18 };
  const row = toEmployee(values);
  expect(row.ipa_basic_monthly_salary).toBe(400);
  expect(row.basic_salary).toBe(18);
  const restored = fromEmployee(row);
  expect(restored.basicMonthlySalary).toBe(400);
  expect(restored.basicSalary).toBe(18);
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
test("fills every printed field, including amounts read as text", async () => {
    const { ipaEmployeeDefaults: fill } = await import("./ipa-registration");
    const v = fill({
      name: "MD ABU SAYED", dateOfBirth: "2003-12-01", gender: "MALE", nationality: "BANGLADESHI",
      passportNumber: "A08396381", workPermitNumber: "0 65757656", fin: "M3536410W", applicationDate: "2024-10-10",
      employerName: "PLUTO SYSTEM ENGINEERING PTE. LTD.", industry: "PROCESS", occupation: "PROCESS MAINTENANCE & CONSTRUCTION WORKER",
      agencyName: "DIRECTION OVERSEAS PTE. LTD.", agencyFee: "S$ 200" as never, housingProvided: "YES",
      normalHoursPerWeek: "44.0" as never, workingDaysPerWeek: "6.000" as never, otRate: "S$ 3.15" as never,
      dailyRestDayRate: 15.38, declaredSalary: "S$ 400" as never, basicMonthlySalary: 400, fixedAllowance: 0,
      housingDeduction: 0, otherDeduction: "S$ 0" as never,
    }, "r2://ipa.pdf");
    expect(v).toMatchObject({
      name: "MD ABU SAYED", gender: "Male", fin: "M3536410W", applicationDate: "2024-10-10",
      employerName: "PLUTO SYSTEM ENGINEERING PTE. LTD.", industry: "PROCESS", trade: "PROCESS MAINTENANCE & CONSTRUCTION WORKER",
      agencyName: "DIRECTION OVERSEAS PTE. LTD.", agencyFee: 200, housingProvided: "Yes", normalHoursPerWeek: 44,
      workingDaysPerWeek: 6, otRate: 3.15, dailyRestDayRate: 15.38, declaredSalary: 400, basicMonthlySalary: 400,
      fixedAllowance: 0, housingDeduction: 0, otherDeduction: 0,
    });
});
