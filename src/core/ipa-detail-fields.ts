import type { Employee } from "@/lib/types";

export const IPA_DETAIL_FIELDS = [
  { key: "highestQualification", column: "highest_qualification", label: "Highest qualification", section: "personal", kind: "text" },
  { key: "fatherName", column: "father_name", label: "Father’s name", section: "personal", kind: "text" },
  { key: "motherName", column: "mother_name", label: "Mother’s name", section: "personal", kind: "text" },
  { key: "criminalRecord", column: "criminal_record", label: "Arrest / criminal record", section: "personal", kind: "yesno" },
  { key: "industry", column: "industry", label: "Industry", section: "employment", kind: "text" },
  { key: "occupationCode", column: "occupation_code", label: "Occupation code", section: "employment", kind: "text" },
  { key: "housingProvided", column: "housing_provided", label: "Housing provided", section: "employment", kind: "yesno" },
  { key: "basicMonthlySalary", column: "ipa_basic_monthly_salary", label: "IPA basic monthly salary ($)", section: "pay", kind: "number" },
  { key: "housingDeduction", column: "ipa_housing_deduction", label: "IPA monthly housing deduction ($)", section: "pay", kind: "number" },
  { key: "otherDeduction", column: "ipa_other_deduction", label: "IPA other monthly deductions ($)", section: "pay", kind: "number" },
  { key: "monthlySalaryAfterDeductions", column: "ipa_net_monthly_salary", label: "IPA net monthly salary ($)", section: "pay", kind: "number" },
  { key: "normalHoursPerWeek", column: "ipa_normal_hours_per_week", label: "IPA normal working hours / week", section: "pay", kind: "number" },
  { key: "workingDaysPerWeek", column: "ipa_working_days_per_week", label: "IPA working days / week", section: "pay", kind: "number" },
  { key: "dailyRestDayRate", column: "ipa_daily_rest_day_rate", label: "IPA rest day / public holiday daily rate ($)", section: "pay", kind: "number" },
  { key: "agencyName", column: "agency_name", label: "Agency name", section: "agency", kind: "text" },
  { key: "agencyLicence", column: "agency_licence", label: "Agency licence number", section: "agency", kind: "text" },
  { key: "agencyAddress", column: "agency_address", label: "Agency address", section: "agency", kind: "text" },
  { key: "agencyPhone", column: "agency_phone", label: "Agency phone", section: "agency", kind: "text" },
  { key: "agencyFee", column: "agency_fee", label: "Agency fee ($)", section: "agency", kind: "number" },
  { key: "overseasCosts", column: "agency_overseas_costs", label: "Overseas costs ($)", section: "agency", kind: "number" },
  { key: "employeePaidFees", column: "agency_employee_paid_fees", label: "Fees paid by employee", section: "agency", kind: "yesno" },
] as const satisfies readonly { key: keyof Employee; column: string; label: string; section: string; kind: string }[];

export function ipaDetailsFromForm(fd: FormData): Partial<Employee> {
  const result: Record<string, unknown> = {};
  for (const field of IPA_DETAIL_FIELDS) {
    if (!fd.has(field.key)) continue;
    const value = String(fd.get(field.key) ?? "").trim();
    result[field.key] = value === "" ? undefined : field.kind === "number" ? Number(value) : value;
  }
  return result as Partial<Employee>;
}
