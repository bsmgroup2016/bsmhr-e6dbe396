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
export type EmployeeStatus =
  | "Draft"
  | "Pending Approval"
  | "Active"
  | "Inactive"
  | "On Leave"
  | "Deployed"
  | "Suspended"
  | "Resigned"
  | "Terminated"
  | "Repatriated"
  | "Archived";

export type DeploymentStatus = "Available" | "Deployed" | "On Leave" | "Blocked" | "Not Deployable";
export type EmploymentType = "Full Time" | "Part Time" | "Contract" | "Casual" | "Project Based";
export type WorkerCategory = "Skilled" | "Semi-Skilled" | "General Worker" | "Supervisor" | "Office Staff" | "Driver";
export type PaymentMethod = "Bank Transfer" | "GIRO" | "PayNow" | "Cash" | "Cheque";
export type PayrollFrequency = "Monthly" | "Bi-Weekly" | "Weekly" | "Daily";

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
  photoUrl?: string;
  branch?: string;
  companyId?: string;
  remarks?: string;
  // --- Phase 2: personal information ---
  preferredName?: string;
  dateOfBirth?: string;
  gender?: "Male" | "Female" | "Other";
  maritalStatus?: "Single" | "Married" | "Divorced" | "Widowed";
  altPhone?: string;
  homeCountryAddress?: string;
  postalCode?: string;
  emergencyRelation?: string;
  emergencyEmail?: string;
  bankName?: string;
  bankAccount?: string;
  paymentMethod?: PaymentMethod;
  // --- Phase 2: employment information ---
  department?: string;
  employmentType?: EmploymentType;
  workerCategory?: WorkerCategory;
  jobTitle?: string;
  secondarySkills?: string;
  applicationDate?: string;
  confirmationDate?: string;
  contractStart?: string;
  contractEnd?: string;
  deploymentStatus?: DeploymentStatus;
  reportingManager?: string;
  siteSupervisor?: string;
  payrollGroup?: string;
  payrollFrequency?: PayrollFrequency;
  lastWorkingDate?: string;
  exitReason?: string;
  internalNotes?: string;
  // --- Phase 2: identity / compensation ---
  passportNumber?: string;
  passportExpiry?: string;
  workPermitNumber?: string;
  otRate?: number;
  normalHours?: number;
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
  | "IPA Letter"
  | "In-Principle Approval"
  | "Training Certificate"
  | "Contract"
  | "Bank Letter"
  | "Other";

export type DocumentStatus = "Valid" | "Expiring Soon" | "Expired" | "Pending" | "Superseded";

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  type: DocumentType;
  name: string;
  fileUrl?: string;
  issueDate?: string;
  expiryDate?: string;
  status: DocumentStatus;
  // --- Phase 3: compliance metadata ---
  docNumber?: string;
  issuingAuthority?: string;
  reminderDays?: number;
  verified?: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  remarks?: string;
  version?: number;
  replacesId?: string;
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

export type LeaveType =
  | "Annual Leave"
  | "Medical Leave"
  | "Hospitalisation Leave"
  | "Unpaid Leave"
  | "Home Leave"
  | "Compassionate Leave";

export type LeaveStatus = "Pending" | "Approved" | "Rejected" | "Cancelled";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason?: string;
  status: LeaveStatus;
  approvedBy?: string;
  approvedAt?: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

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

/* ---------------- Phase 6: Billing & Invoicing ---------------- */

export type RateUnit = "Hourly" | "Daily" | "Monthly";

export interface RateAgreement {
  id: string;
  clientId: string;
  projectId?: string;
  trade: string;
  unit: RateUnit;
  normalRate: number;
  otRate: number;
  effectiveFrom: string;
  effectiveTo?: string;
  status: "Active" | "Inactive";
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLine {
  description: string;
  employeeId?: string;
  trade?: string;
  unit: RateUnit;
  quantity: number;
  rate: number;
  otQuantity: number;
  otRate: number;
  amount: number;
}

export type InvoiceStatus = "Draft" | "Sent" | "Partially Paid" | "Paid" | "Overdue" | "Cancelled";

export interface Invoice {
  id: string;
  companyId: string;
  clientId: string;
  projectId?: string;
  invoiceNo: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  lines: InvoiceLine[];
  subtotal: number;
  gstRate: number;
  gstAmount: number;
  total: number;
  amountPaid: number;
  status: InvoiceStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}
