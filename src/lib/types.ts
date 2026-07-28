export type AppRole = "admin" | "manager" | "supervisor" | "client" | "hr" | "payroll";

export interface User {
  id: string;
  name: string;
  email: string;
  role: AppRole;
  status: "active" | "inactive";
  branch?: string;
  createdAt: string;
}

export type PassType = "Work Permit" | "S Pass" | "Employment Pass" | "Singaporean/PR";
export type EmployeeStatus = "Active" | "On Leave" | "Deployed" | "Inactive";

export interface Employee {
  id: string;
  employeeCode: string;
  name: string;
  nationality: string;
  fin: string;
  passType: PassType;
  passExpiry: string; // ISO date or "-"
  trade: string;
  site: string | null;
  status: EmployeeStatus;
  basicSalary: number;
  joinedOn: string;
  phone?: string;
  email?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  levyRate?: number;
  dormitory?: string;
  branch?: string;
  companyId?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export type ClientStatus = "Active" | "Inactive" | "Prospect";

export interface Client {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  status: ClientStatus;
  industry?: string;
  contractStart?: string;
  contractEnd?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus = "Planning" | "Active" | "On Hold" | "Completed" | "Cancelled";

export interface Project {
  id: string;
  clientId: string;
  code: string;
  name: string;
  location: string;
  status: ProjectStatus;
  startDate?: string;
  endDate?: string;
  requiredWorkers: number;
  projectManager?: string;
  safetyOfficer?: string;
  createdAt: string;
  updatedAt: string;
}

export type SiteStatus = "Active" | "Inactive" | "Completed";

export interface Site {
  id: string;
  projectId: string;
  code: string;
  name: string;
  location: string;
  status: SiteStatus;
  supervisorId?: string;
  requiredWorkers: number;
  createdAt: string;
  updatedAt: string;
}

export type AssignmentStatus = "Pending" | "Approved" | "Rejected" | "Active" | "Ended" | "Transferred";

export interface Assignment {
  id: string;
  employeeId: string;
  siteId: string;
  projectId: string;
  startDate: string;
  endDate?: string;
  status: AssignmentStatus;
  approvedBy?: string;
  approvedAt?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export type DocumentType =
  | "Passport"
  | "Work Permit"
  | "S Pass"
  | "Employment Pass"
  | "IC"
  | "Safety Certificate"
  | "P-File"
  | "Medical Report"
  | "Insurance"
  | "Other";

export type DocumentStatus = "Valid" | "Expiring Soon" | "Expired" | "Pending";

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  type: DocumentType;
  name: string;
  fileUrl?: string;
  issueDate?: string;
  expiryDate?: string;
  status: DocumentStatus;
  uploadedAt: string;
  updatedAt: string;
}

export type AttendanceStatus = "Present" | "Absent" | "On Leave" | "MC" | "Half Day" | "Off" | "Public Holiday" | "Pending";

export interface Attendance {
  id: string;
  employeeId: string;
  date: string;
  siteId?: string;
  status: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  hoursWorked: number;
  overtimeHours: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PayrollStatus = "Draft" | "Pending Approval" | "Approved" | "Paid" | "Rejected";

export interface PayrollEntry {
  id: string;
  employeeId: string;
  month: string; // YYYY-MM
  basicSalary: number;
  overtimePay: number;
  allowances: number;
  deductions: number;
  cpfEmployee: number;
  cpfEmployer: number;
  levies: number;
  netPay: number;
  status: PayrollStatus;
  approvedBy?: string;
  approvedAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type ApprovalType = "Assignment" | "Leave" | "Payroll" | "Overtime" | "Transfer" | "Termination" | "Document" | "Other";
export type ApprovalStatus = "Pending" | "Approved" | "Rejected" | "Escalated";

export interface Approval {
  id: string;
  type: ApprovalType;
  title: string;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  status: ApprovalStatus;
  payload: string;
  approverId?: string;
  approverName?: string;
  approverNotes?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  userName: string;
  timestamp: string;
  details: string;
}

export interface AppBranch {
  id: string;
  name: string;
  location: string;
  status: "Active" | "Inactive";
}

export interface Company {
  id: string;
  code: string;
  name: string;
  legalName: string;
  uen: string;
  industry: string;
  address: string;
  phone: string;
  email: string;
  status: "Active" | "Inactive";
  accent: "primary" | "success" | "warning" | "info" | "destructive";
  createdAt: string;
  updatedAt: string;
}
