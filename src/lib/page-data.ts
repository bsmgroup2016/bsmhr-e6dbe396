import type { CollectionKey } from "@/lib/db";

/** Only business collections used by the page and its rendered forms/panels. */
const pages: Record<string, CollectionKey[]> = {
  dashboard: ["employees", "sites", "projects", "approvals", "documents", "auditLogs", "attendance", "leads", "activities", "clients", "leaveRequests", "certifications", "payroll", "assignments"],
  workforce: ["employees", "projects", "assignments", "clients", "sites", "branchPrefixes", "certifications", "documents", "payroll", "departments", "designations"],
  "available-workers": ["employees", "assignments", "sites", "certifications", "documents", "branchPrefixes"],
  "deployed-workers": ["employees", "assignments", "projects", "sites", "clients", "certifications", "documents"],
  "deployment-history": ["assignments", "clients", "employees", "projects", "sites"],
  clients: ["clients", "projects", "sites", "assignments", "employees", "invoices", "rateAgreements", "contracts"],
  companies: ["employees", "projects", "clients", "sites", "assignments", "leaveRequests"],
  projects: ["clients", "projects", "sites", "assignments", "employees", "certifications"],
  operations: ["employees", "projects", "sites", "assignments", "users", "clients", "certifications", "documents", "payroll", "rateAgreements", "expenses", "invoices"],
  documents: ["documents", "employees"], compliance: ["employees", "documents", "certifications"],
  mom: ["employees", "documents", "certifications", "payroll", "loans", "loanRepayments", "medicalClaims"],
  approvals: ["approvals", "users", "employees", "leaveRequests", "assignments"],
  "time-management": ["employees", "sites"],
  "staff-attendance": ["employees", "attendance", "leaveRequests"],
  "staff-payroll": ["employees", "attendance"],
  "staff-management": ["employees", "leaveRequests", "departments", "designations", "branchPrefixes", "payroll", "documents", "certifications"],
  payroll: ["employees", "payroll", "attendance", "loans", "loanRepayments", "medicalClaims", "issuances", "assets"],
  "time-cards": ["employees", "timeCards", "claimSheets", "attendance", "sites", "projects", "clients"],
  "claim-generator": ["employees", "timeCards", "claimSheets", "attendance", "sites", "projects", "clients", "assignments"],
  "claim-workflow": ["employees", "claimSheets", "sites", "projects", "clients"],
  leave: ["employees", "leaveRequests", "attendance"],
  billing: ["clients", "projects", "invoices", "rateAgreements", "contracts", "receipts", "expenses", "attendance", "employees", "sites", "assignments"],
  contracts: ["clients", "rateAgreements", "contracts", "projects", "attendance", "employees", "sites", "assignments", "invoices"],
  quotations: ["clients", "projects", "quotations", "contracts", "rateAgreements"],
  finance: ["expenses", "receipts", "invoices", "clients", "projects", "employees", "payroll", "dormitories", "allocations", "fuelLogs", "attendance", "sites"],
  crm: ["leads", "activities", "clients"],
  accommodation: ["dormitories", "allocations", "employees"],
  transport: ["vehicles", "trips", "employees", "sites", "fuelLogs", "driverProfiles", "driverIncidents"],
  drivers: ["employees", "vehicles", "driverProfiles", "driverIncidents", "fuelLogs"],
  "driver-compliance": ["employees", "vehicles", "driverProfiles", "driverIncidents", "fuelLogs"],
  "driver-dispatch": ["employees", "vehicles", "sites", "driverProfiles"],
  "driver-duty": ["trips", "vehicles", "employees", "sites", "driverProfiles"],
  assets: ["assets", "issuances", "employees", "sites"],
  inventory: ["inventory", "movements", "purchaseOrders", "sites", "employees", "assets"],
  training: ["courses", "trainings", "incidents", "employees", "sites"],
  recruitment: ["requisitions", "candidates", "clients", "sites", "employees", "branchPrefixes"],
  reports: ["employees", "projects", "sites", "assignments", "documents", "payroll", "attendance", "leaveRequests", "invoices", "expenses", "leads", "candidates", "incidents", "trainings", "assets", "issuances", "dormitories", "allocations", "vehicles", "trips", "inventory", "movements"],
  settings: ["branchPrefixes", "departments", "designations", "employees"],
  users: ["users"], "audit-logs": [], assistant: [],
  "my-portal": ["documents", "employees", "leaveRequests", "payroll", "attendance", "driverProfiles", "vehicles", "sites"],
  "qr-punch": ["employees", "sites", "attendance"],
  alerts: ["employees", "documents", "payroll", "leaveRequests", "invoices", "approvals"],
};

export function pageCollections(pathname: string): CollectionKey[] {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "workforce" && parts.length > 1) return ["companies", "employees", "assignments", "attendance", "payroll", "documents", "auditLogs", "sites", "projects", "clients", "certifications", "branchPrefixes", "timeCards", "claimSheets", "medicalClaims", "loans", "loanRepayments", "departments", "designations", "dormitories", "allocations", "assets", "issuances", "driverProfiles", "vehicles", "driverIncidents"];
  return [...new Set<CollectionKey>(["companies", ...(pages[parts[0] ?? "dashboard"] ?? [])])];
}