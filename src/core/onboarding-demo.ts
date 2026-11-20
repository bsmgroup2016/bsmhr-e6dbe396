import type { Company, Employee } from "@/lib/types";
import { newOnboarding, ONBOARD_STAGES, onboardingEmployeePatch, type Onboarding } from "./onboarding";

export const DEMO_COMPANIES: Company[] = [
  { id: "demo-bsm", name: "BSM Engineering & Construction Pte Ltd", code: "BSM" },
  { id: "demo-vrl", name: "VRL Engineering Pte Ltd", code: "VRL" },
  { id: "demo-pluto", name: "Pluto System Engineering Pte Ltd", code: "PLUTO" },
].map(company => ({ ...company, legalName: company.name, uen: "", industry: "Construction", address: "", phone: "", email: "", status: "Active", accent: "primary", createdAt: "2026-11-16T00:00:00Z", updatedAt: "2026-11-19T00:00:00Z" }));

export function createOnboardingDemo(companies: Pick<Company, "id" | "name" | "code">[] = DEMO_COMPANIES): Employee[] {
  const names = ["Arif Hossain", "Ravi Kumar", "Nur Islam", "Suresh Raj", "Jamal Uddin", "Mohamed Rafiq"];
  return ONBOARD_STAGES.map((stage, index) => {
    const fallback = DEMO_COMPANIES[index % 3];
    const company = companies.find(c => `${c.code} ${c.name}`.toUpperCase().includes(fallback.code)) ?? fallback;
    const worker: Employee = {
      id: `demo-onboarding-${index + 1}`, name: names[index], employeeCode: `DEMO-${["B", "V", "P"][index % 3]}${String(index + 1).padStart(3, "0")}`,
      companyId: company.id, nationality: index % 2 ? "Indian" : "Bangladeshi", fin: "", passportNumber: "",
      passType: "Work Permit", passExpiry: "-", trade: index % 2 ? "Electrician" : "General Worker", site: null,
      status: "Pending Approval", deploymentStatus: "Not Deployable", department: "Construction", basicSalary: 0, joinedOn: "",
      createdAt: "2026-11-16T00:00:00Z", updatedAt: "2026-11-19T00:00:00Z",
      ...(stage === "Work Permit issued" ? { workPermitNumber: "DEMO-WP006", workPermitIssueDate: "2026-11-19", workPermitExpiryDate: "2027-11-18" } : {}),
    };
    const data: Onboarding = { ...newOnboarding(), stage,
      bookingDate: index ? "2026-11-16" : "", centre: index ? "Onboard Centre (sample)" : "",
      completedDate: index >= 3 ? "2026-11-18" : "", appointmentDate: index >= 4 ? "2026-11-19" : "",
      appointmentReference: index >= 4 ? `DEMO-MOM-${index + 1}` : "", notes: "Sample record",
    };
    return { ...worker, ...onboardingEmployeePatch(worker, data) };
  });
}

export function updateOnboardingDemo(employee: Employee, data: Onboarding, permit: Pick<Employee, "workPermitNumber" | "workPermitIssueDate" | "workPermitExpiryDate">): Employee {
  if (!employee.id.startsWith("demo-onboarding-")) throw new Error("Only sample records can be changed in demo mode");
  const values = { ...employee, ...permit };
  return { ...values, ...onboardingEmployeePatch(values, data) };
}