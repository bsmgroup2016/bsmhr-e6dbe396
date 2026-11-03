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
  { key: "countryOfBirth", column: "ipa_country_of_birth", label: "Country / region of birth", section: "personal", kind: "text" },
  { key: "raceAsDeclared", column: "ipa_race", label: "Race as declared in IPA", section: "personal", kind: "text" },
  { key: "previouslySingaporeCitizenPr", column: "ipa_previously_sc_pr", label: "Previously Singapore citizen / PR", section: "personal", kind: "yesno" },
  { key: "everArrested", column: "ipa_ever_arrested", label: "Ever arrested", section: "personal", kind: "yesno" },
  { key: "everConvicted", column: "ipa_ever_convicted", label: "Ever convicted of a criminal offence", section: "personal", kind: "yesno" },
  { key: "addressHistory", column: "ipa_address_history", label: "Address history and years of stay", section: "personal", kind: "text" },
  { key: "travelDocumentType", column: "ipa_travel_document_type", label: "Travel document type", section: "personal", kind: "text" },
  { key: "immigrationStatusAtApplication", column: "ipa_immigration_status", label: "Immigration status at application", section: "personal", kind: "text" },
  { key: "employerName", column: "ipa_employer_name", label: "Employer name on IPA", section: "employer", kind: "text" },
  { key: "employerCpfSubmissionNumber", column: "ipa_employer_cpf_submission", label: "Employer CPF submission number", section: "employer", kind: "text" },
  { key: "employerUen", column: "ipa_employer_uen", label: "Employer registration number / UEN", section: "employer", kind: "text" },
  { key: "employerBusinessActivity", column: "ipa_employer_business_activity", label: "Employer business activity", section: "employer", kind: "text" },
  { key: "employerRegisteredAddress", column: "ipa_employer_registered_address", label: "Employer address in application", section: "employer", kind: "text" },
  { key: "employerCorrespondenceAddress", column: "ipa_employer_correspondence_address", label: "Employer address on approval letter", section: "employer", kind: "text" },
  { key: "employerPhone", column: "ipa_employer_phone", label: "Employer telephone", section: "employer", kind: "text" },
  { key: "sbTransmissionReference", column: "ipa_sb_transmission_ref", label: "SB transmission reference number", section: "personal", kind: "text" },
  { key: "temporaryPermitUponApproval", column: "ipa_temporary_permit", label: "Temporary permit upon approval", section: "personal", kind: "yesno" },
  { key: "monthlyHousingAllowance", column: "ipa_housing_allowance", label: "IPA housing / amenities / services allowance ($)", section: "pay", kind: "number" },
  { key: "monthlyTransportAllowance", column: "ipa_transport_allowance", label: "IPA monthly transport allowance ($)", section: "pay", kind: "number" },
  { key: "otherMonthlyAllowances", column: "ipa_other_allowances", label: "IPA other monthly allowances ($)", section: "pay", kind: "number" },
  { key: "hasFixedMonthlyAllowances", column: "ipa_has_fixed_allowances", label: "Has fixed monthly allowances", section: "pay", kind: "yesno" },
  { key: "hasFixedMonthlyDeductions", column: "ipa_has_fixed_deductions", label: "Has fixed monthly deductions", section: "pay", kind: "yesno" },
  { key: "totalFixedMonthlyDeductions", column: "ipa_total_fixed_deductions", label: "IPA total fixed monthly deductions ($)", section: "pay", kind: "number" },
  { key: "agencyUsed", column: "ipa_agency_used", label: "Employment agency used", section: "agency", kind: "yesno" },
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
