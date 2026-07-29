// Supabase data layer: maps DB rows (snake_case) <-> app types (camelCase).
import { supabase } from "@/integrations/supabase/client";
import type {
  Employee, Client, Project, Site, Assignment, EmployeeDocument,
  Attendance, PayrollEntry, Approval, AuditLog, Company, User,
  LeaveRequest, RateAgreement, Invoice, InvoiceLine,
} from "@/lib/types";

type Row = Record<string, any>;

const d = (v: any) => (v ? String(v).slice(0, 10) : undefined);

/* ---------- mappers: row -> app ---------- */
export const fromCompany = (r: Row): Company => ({
  id: r.id, code: r.code, name: r.name, legalName: r.legal_name ?? "", uen: r.uen ?? "",
  industry: r.industry ?? "", address: r.address ?? "", phone: r.phone ?? "", email: r.email ?? "",
  status: (r.status ?? "Active") as Company["status"], accent: (r.accent ?? "primary") as Company["accent"],
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const fromEmployee = (r: Row): Employee => ({
  id: r.id, employeeCode: r.employee_code, name: r.name, nationality: r.nationality ?? "",
  fin: r.fin ?? "", passType: (r.pass_type ?? "Work Permit") as Employee["passType"],
  passExpiry: d(r.pass_expiry) ?? "-", trade: r.trade ?? "", site: null,
  status: (r.status ?? "Active") as Employee["status"],
  basicSalary: Number(r.basic_salary ?? 0), levyRate: Number(r.levy_rate ?? 0),
  joinedOn: d(r.joined_on) ?? "", phone: r.phone ?? undefined, email: r.email ?? undefined,
  address: r.address ?? undefined, emergencyContact: r.emergency_contact ?? undefined,
  emergencyPhone: r.emergency_phone ?? undefined, dormitory: r.dormitory ?? undefined,
  photoUrl: r.photo_url ?? undefined,
  branch: r.branch ?? undefined, companyId: r.company_id ?? undefined, remarks: r.remarks ?? undefined,
  preferredName: r.preferred_name ?? undefined, dateOfBirth: d(r.date_of_birth),
  gender: r.gender ?? undefined, maritalStatus: r.marital_status ?? undefined,
  altPhone: r.alt_phone ?? undefined, homeCountryAddress: r.home_country_address ?? undefined,
  postalCode: r.postal_code ?? undefined, emergencyRelation: r.emergency_relation ?? undefined,
  emergencyEmail: r.emergency_email ?? undefined, bankName: r.bank_name ?? undefined,
  bankAccount: r.bank_account ?? undefined, paymentMethod: r.payment_method ?? undefined,
  department: r.department ?? undefined, employmentType: r.employment_type ?? undefined,
  workerCategory: r.worker_category ?? undefined, jobTitle: r.job_title ?? undefined,
  secondarySkills: r.secondary_skills ?? undefined, applicationDate: d(r.application_date),
  confirmationDate: d(r.confirmation_date), contractStart: d(r.contract_start),
  contractEnd: d(r.contract_end), deploymentStatus: r.deployment_status ?? undefined,
  reportingManager: r.reporting_manager ?? undefined, siteSupervisor: r.site_supervisor ?? undefined,
  payrollGroup: r.payroll_group ?? undefined, payrollFrequency: r.payroll_frequency ?? undefined,
  lastWorkingDate: d(r.last_working_date), exitReason: r.exit_reason ?? undefined,
  internalNotes: r.internal_notes ?? undefined, passportNumber: r.passport_number ?? undefined,
  passportExpiry: d(r.passport_expiry), workPermitNumber: r.work_permit_number ?? undefined,
  otRate: r.ot_rate != null ? Number(r.ot_rate) : undefined,
  normalHours: r.normal_hours != null ? Number(r.normal_hours) : undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const fromClient = (r: Row): Client => ({
  id: r.id, code: r.code, name: r.name, contactPerson: r.contact_person ?? "", email: r.email ?? "",
  phone: r.phone ?? "", address: r.address ?? "", status: (r.status ?? "Active") as Client["status"],
  industry: r.industry ?? undefined, contractStart: d(r.contract_start), contractEnd: d(r.contract_end),
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const fromProject = (r: Row): Project => ({
  id: r.id, clientId: r.client_id, code: r.code, name: r.name, location: r.location ?? "",
  status: (r.status ?? "Planning") as Project["status"], startDate: d(r.start_date), endDate: d(r.end_date),
  requiredWorkers: r.required_workers ?? 0, projectManager: r.project_manager ?? undefined,
  safetyOfficer: r.safety_officer ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at,
});

export const fromSite = (r: Row): Site => ({
  id: r.id, projectId: r.project_id, code: r.code, name: r.name, location: r.location ?? "",
  status: (r.status ?? "Active") as Site["status"], supervisorId: r.supervisor_id ?? undefined,
  requiredWorkers: r.required_workers ?? 0, createdAt: r.created_at, updatedAt: r.updated_at,
});

export const fromAssignment = (r: Row): Assignment => ({
  id: r.id, employeeId: r.employee_id, siteId: r.site_id, projectId: r.project_id,
  startDate: d(r.start_date) ?? "", endDate: d(r.end_date),
  status: (r.status ?? "Pending") as Assignment["status"], approvedBy: r.approved_by ?? undefined,
  approvedAt: r.approved_at ?? undefined, remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const fromDocument = (r: Row): EmployeeDocument => ({
  id: r.id, employeeId: r.employee_id, type: r.doc_type as EmployeeDocument["type"], name: r.name,
  fileUrl: r.file_url ?? undefined, issueDate: d(r.issue_date), expiryDate: d(r.expiry_date),
  status: (r.status ?? "Valid") as EmployeeDocument["status"],
  docNumber: r.doc_number ?? undefined, issuingAuthority: r.issuing_authority ?? undefined,
  reminderDays: r.reminder_days ?? undefined, verified: r.verified ?? undefined,
  verifiedBy: r.verified_by ?? undefined, verifiedAt: r.verified_at ?? undefined,
  remarks: r.remarks ?? undefined, version: r.version ?? undefined, replacesId: r.replaces_id ?? undefined,
  uploadedAt: r.uploaded_at, updatedAt: r.updated_at,
});

export const fromAttendance = (r: Row): Attendance => ({
  id: r.id, employeeId: r.employee_id, date: d(r.date) ?? "", siteId: r.site_id ?? undefined,
  status: (r.status ?? "Present") as Attendance["status"], checkIn: r.check_in ?? undefined,
  checkOut: r.check_out ?? undefined, hoursWorked: Number(r.hours_worked ?? 0),
  overtimeHours: Number(r.overtime_hours ?? 0), notes: r.notes ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const fromPayroll = (r: Row): PayrollEntry => ({
  id: r.id, employeeId: r.employee_id, month: r.month, basicSalary: Number(r.basic_salary ?? 0),
  overtimePay: Number(r.overtime_pay ?? 0), allowances: Number(r.allowances ?? 0),
  deductions: Number(r.deductions ?? 0), cpfEmployee: Number(r.cpf_employee ?? 0),
  cpfEmployer: Number(r.cpf_employer ?? 0), levies: Number(r.levies ?? 0), netPay: Number(r.net_pay ?? 0),
  status: (r.status ?? "Draft") as PayrollEntry["status"], approvedBy: r.approved_by ?? undefined,
  approvedAt: r.approved_at ?? undefined, paidAt: r.paid_at ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const fromApproval = (r: Row): Approval => ({
  id: r.id, type: r.type as Approval["type"], title: r.title, requestedBy: r.requested_by ?? "",
  requestedByName: r.requested_by_name ?? "", requestedAt: r.requested_at,
  status: (r.status ?? "Pending") as Approval["status"],
  payload: typeof r.payload === "string" ? r.payload : (r.payload?.text ?? JSON.stringify(r.payload ?? {})),
  approverId: r.approver_id ?? undefined, approverName: r.approver_name ?? undefined,
  approverNotes: r.approver_notes ?? undefined, decidedAt: r.decided_at ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const fromAuditLog = (r: Row): AuditLog => ({
  id: r.id, action: r.action, entityType: r.entity_type, entityId: r.entity_id ?? "",
  userId: r.user_id ?? "", userName: r.user_name ?? "System", timestamp: r.created_at,
  details: typeof r.details === "string" ? r.details : (r.details?.text ?? ""),
});

/* ---------- mappers: app -> row ---------- */
const nullDate = (v?: string | null) => (v && v !== "-" ? v.slice(0, 10) : null);

export const toEmployee = (e: Partial<Employee>): Row => ({
  employee_code: e.employeeCode, name: e.name, nationality: e.nationality, fin: e.fin,
  pass_type: e.passType, pass_expiry: nullDate(e.passExpiry), trade: e.trade, status: e.status,
  basic_salary: e.basicSalary, levy_rate: e.levyRate, joined_on: nullDate(e.joinedOn),
  phone: e.phone, email: e.email, address: e.address, emergency_contact: e.emergencyContact,
  emergency_phone: e.emergencyPhone, dormitory: e.dormitory, branch: e.branch,
  photo_url: e.photoUrl || null,
  company_id: e.companyId || null, remarks: e.remarks,
  preferred_name: e.preferredName ?? null, date_of_birth: nullDate(e.dateOfBirth),
  gender: e.gender ?? null, marital_status: e.maritalStatus ?? null,
  alt_phone: e.altPhone ?? null, home_country_address: e.homeCountryAddress ?? null,
  postal_code: e.postalCode ?? null, emergency_relation: e.emergencyRelation ?? null,
  emergency_email: e.emergencyEmail ?? null, bank_name: e.bankName ?? null,
  bank_account: e.bankAccount ?? null, payment_method: e.paymentMethod ?? null,
  department: e.department ?? null, employment_type: e.employmentType ?? null,
  worker_category: e.workerCategory ?? null, job_title: e.jobTitle ?? null,
  secondary_skills: e.secondarySkills ?? null, application_date: nullDate(e.applicationDate),
  confirmation_date: nullDate(e.confirmationDate), contract_start: nullDate(e.contractStart),
  contract_end: nullDate(e.contractEnd), deployment_status: e.deploymentStatus ?? null,
  reporting_manager: e.reportingManager ?? null, site_supervisor: e.siteSupervisor ?? null,
  payroll_group: e.payrollGroup ?? null, payroll_frequency: e.payrollFrequency ?? null,
  last_working_date: nullDate(e.lastWorkingDate), exit_reason: e.exitReason ?? null,
  internal_notes: e.internalNotes ?? null, passport_number: e.passportNumber ?? null,
  passport_expiry: nullDate(e.passportExpiry), work_permit_number: e.workPermitNumber ?? null,
  ot_rate: e.otRate ?? null, normal_hours: e.normalHours ?? null,
});

export const toClient = (c: Partial<Client>): Row => ({
  code: c.code, name: c.name, contact_person: c.contactPerson, email: c.email, phone: c.phone,
  address: c.address, industry: c.industry, status: c.status,
  contract_start: nullDate(c.contractStart), contract_end: nullDate(c.contractEnd),
});

export const toProject = (p: Partial<Project>): Row => ({
  client_id: p.clientId, code: p.code, name: p.name, location: p.location, status: p.status,
  start_date: nullDate(p.startDate), end_date: nullDate(p.endDate),
  required_workers: p.requiredWorkers, project_manager: p.projectManager, safety_officer: p.safetyOfficer,
});

export const toSite = (s: Partial<Site>): Row => ({
  project_id: s.projectId, code: s.code, name: s.name, location: s.location, status: s.status,
  supervisor_id: s.supervisorId || null, required_workers: s.requiredWorkers,
});

export const toAssignment = (a: Partial<Assignment>): Row => ({
  employee_id: a.employeeId, site_id: a.siteId, project_id: a.projectId,
  start_date: nullDate(a.startDate), end_date: nullDate(a.endDate), status: a.status,
  approved_by: a.approvedBy || null, approved_at: a.approvedAt || null, remarks: a.remarks,
});

export const toDocument = (x: Partial<EmployeeDocument>): Row => ({
  employee_id: x.employeeId, doc_type: x.type, name: x.name, file_url: x.fileUrl,
  issue_date: nullDate(x.issueDate), expiry_date: nullDate(x.expiryDate), status: x.status,
  doc_number: x.docNumber || null, issuing_authority: x.issuingAuthority || null,
  reminder_days: x.reminderDays ?? null, verified: x.verified ?? false,
  verified_by: x.verifiedBy || null, verified_at: x.verifiedAt || null,
  remarks: x.remarks || null, version: x.version ?? 1, replaces_id: x.replacesId || null,
});

export const toAttendance = (a: Partial<Attendance>): Row => ({
  employee_id: a.employeeId, site_id: a.siteId || null, date: nullDate(a.date), status: a.status,
  check_in: a.checkIn || null, check_out: a.checkOut || null,
  hours_worked: a.hoursWorked ?? 0, overtime_hours: a.overtimeHours ?? 0, notes: a.notes,
});

export const toPayroll = (p: Partial<PayrollEntry>): Row => ({
  employee_id: p.employeeId, month: p.month, basic_salary: p.basicSalary ?? 0,
  overtime_pay: p.overtimePay ?? 0, allowances: p.allowances ?? 0, deductions: p.deductions ?? 0,
  cpf_employee: p.cpfEmployee ?? 0, cpf_employer: p.cpfEmployer ?? 0, levies: p.levies ?? 0,
  net_pay: p.netPay ?? 0, status: p.status, approved_by: p.approvedBy || null,
  approved_at: p.approvedAt || null, paid_at: p.paidAt || null,
});

export const toApproval = (a: Partial<Approval>): Row => ({
  type: a.type, title: a.title, requested_by: a.requestedBy || null,
  requested_by_name: a.requestedByName, status: a.status,
  payload: { text: a.payload ?? "" }, approver_id: a.approverId || null,
  approver_name: a.approverName, approver_notes: a.approverNotes, decided_at: a.decidedAt || null,
});

export const toCompany = (c: Partial<Company>): Row => ({
  code: c.code, name: c.name, legal_name: c.legalName, uen: c.uen, industry: c.industry,
  address: c.address, phone: c.phone, email: c.email, status: c.status, accent: c.accent,
});

export const fromLeave = (r: Row): LeaveRequest => ({
  id: r.id, employeeId: r.employee_id, type: (r.leave_type ?? "Annual Leave") as LeaveRequest["type"],
  startDate: d(r.start_date) ?? "", endDate: d(r.end_date) ?? "", days: Number(r.days ?? 0),
  reason: r.reason ?? undefined, status: (r.status ?? "Pending") as LeaveRequest["status"],
  approvedBy: r.approved_by ?? undefined, approvedAt: r.approved_at ?? undefined,
  remarks: r.remarks ?? undefined, createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toLeave = (l: Partial<LeaveRequest>): Row => ({
  employee_id: l.employeeId, leave_type: l.type, start_date: nullDate(l.startDate),
  end_date: nullDate(l.endDate), days: l.days ?? 0, reason: l.reason ?? null,
  status: l.status, approved_by: l.approvedBy || null, approved_at: l.approvedAt || null,
  remarks: l.remarks ?? null,
});

/* ---------- billing ---------- */
export const fromRate = (r: Row): RateAgreement => ({
  id: r.id, clientId: r.client_id, projectId: r.project_id ?? undefined,
  trade: r.trade ?? "", unit: (r.unit ?? "Hourly") as RateAgreement["unit"],
  normalRate: Number(r.normal_rate ?? 0), otRate: Number(r.ot_rate ?? 0),
  effectiveFrom: d(r.effective_from) ?? "", effectiveTo: d(r.effective_to),
  status: (r.status ?? "Active") as RateAgreement["status"], remarks: r.remarks ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toRate = (a: Partial<RateAgreement>): Row => ({
  client_id: a.clientId, project_id: a.projectId || null, trade: a.trade, unit: a.unit,
  normal_rate: a.normalRate ?? 0, ot_rate: a.otRate ?? 0,
  effective_from: nullDate(a.effectiveFrom), effective_to: nullDate(a.effectiveTo),
  status: a.status, remarks: a.remarks ?? null,
});

export const fromInvoice = (r: Row): Invoice => ({
  id: r.id, companyId: r.company_id ?? "", clientId: r.client_id,
  projectId: r.project_id ?? undefined, invoiceNo: r.invoice_no ?? "",
  periodStart: d(r.period_start) ?? "", periodEnd: d(r.period_end) ?? "",
  issueDate: d(r.issue_date) ?? "", dueDate: d(r.due_date) ?? "",
  lines: Array.isArray(r.lines) ? (r.lines as InvoiceLine[]) : [],
  subtotal: Number(r.subtotal ?? 0), gstRate: Number(r.gst_rate ?? 0),
  gstAmount: Number(r.gst_amount ?? 0), total: Number(r.total ?? 0),
  amountPaid: Number(r.amount_paid ?? 0),
  status: (r.status ?? "Draft") as Invoice["status"], notes: r.notes ?? undefined,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export const toInvoice = (i: Partial<Invoice>): Row => ({
  company_id: i.companyId || null, client_id: i.clientId, project_id: i.projectId || null,
  invoice_no: i.invoiceNo, period_start: nullDate(i.periodStart), period_end: nullDate(i.periodEnd),
  issue_date: nullDate(i.issueDate), due_date: nullDate(i.dueDate), lines: i.lines ?? [],
  subtotal: i.subtotal ?? 0, gst_rate: i.gstRate ?? 0, gst_amount: i.gstAmount ?? 0,
  total: i.total ?? 0, amount_paid: i.amountPaid ?? 0, status: i.status, notes: i.notes ?? null,
});

/* ---------- bulk load ---------- */
export interface LoadedData {
  companies: Company[]; employees: Employee[]; clients: Client[]; projects: Project[];
  sites: Site[]; assignments: Assignment[]; documents: EmployeeDocument[];
  attendance: Attendance[]; payroll: PayrollEntry[]; approvals: Approval[];
  auditLogs: AuditLog[]; users: User[]; leaveRequests: LeaveRequest[];
  rateAgreements: RateAgreement[]; invoices: Invoice[];
}

async function all(table: string, order = "created_at") {
  const { data, error } = await supabase.from(table).select("*").order(order, { ascending: false });
  if (error) { console.error(`[db] ${table}:`, error.message); return []; }
  return (data ?? []) as Row[];
}

export async function loadAll(): Promise<LoadedData> {
  const [
    companies, employees, clients, projects, sites, assignments,
    documents, attendance, payroll, approvals, auditLogs, profiles, roles, leaveRequests,
    rateAgreements, invoices,
  ] = await Promise.all([
    all("companies"), all("employees"), all("clients"), all("projects"), all("sites"),
    all("assignments"), all("employee_documents"), all("attendance"), all("payroll_entries"),
    all("approvals"), all("audit_logs"), all("profiles"), all("user_roles"), all("leave_requests"),
    all("rate_agreements"), all("invoices"),
  ]);

  const roleByUser = new Map<string, string>();
  for (const r of roles) if (!roleByUser.has(r.user_id)) roleByUser.set(r.user_id, r.role);

  const users: User[] = profiles.map((p) => ({
    id: p.id,
    name: p.full_name ?? p.email ?? "User",
    email: p.email ?? "",
    role: (roleByUser.get(p.id) ?? "client") as User["role"],
    status: "active",
    createdAt: p.created_at,
  }));

  const siteById = new Map(sites.map((s) => [s.id, s.name]));
  const activeSiteByEmp = new Map<string, string>();
  for (const a of assignments) {
    if (a.status === "Active" && siteById.has(a.site_id)) activeSiteByEmp.set(a.employee_id, siteById.get(a.site_id)!);
  }

  return {
    companies: companies.map(fromCompany),
    employees: employees.map((r) => ({ ...fromEmployee(r), site: activeSiteByEmp.get(r.id) ?? null })),
    clients: clients.map(fromClient),
    projects: projects.map(fromProject),
    sites: sites.map(fromSite),
    assignments: assignments.map(fromAssignment),
    documents: documents.map(fromDocument),
    attendance: attendance.map(fromAttendance),
    payroll: payroll.map(fromPayroll),
    approvals: approvals.map(fromApproval),
    auditLogs: auditLogs.map(fromAuditLog),
    users,
    leaveRequests: leaveRequests.map(fromLeave),
    rateAgreements: rateAgreements.map(fromRate),
    invoices: invoices.map(fromInvoice),
  };
}
