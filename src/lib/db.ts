// Supabase data layer: maps DB rows (snake_case) <-> app types (camelCase).
import { supabase } from "@/integrations/supabase/client";
import type {
  Employee, Client, Project, Site, Assignment, EmployeeDocument,
  Attendance, PayrollEntry, Approval, AuditLog, Company, User,
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
  branch: r.branch ?? undefined, companyId: r.company_id ?? undefined, remarks: r.remarks ?? undefined,
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
  company_id: e.companyId || null, remarks: e.remarks,
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

/* ---------- bulk load ---------- */
export interface LoadedData {
  companies: Company[]; employees: Employee[]; clients: Client[]; projects: Project[];
  sites: Site[]; assignments: Assignment[]; documents: EmployeeDocument[];
  attendance: Attendance[]; payroll: PayrollEntry[]; approvals: Approval[];
  auditLogs: AuditLog[]; users: User[];
}

async function all(table: string, order = "created_at") {
  const { data, error } = await supabase.from(table).select("*").order(order, { ascending: false });
  if (error) { console.error(`[db] ${table}:`, error.message); return []; }
  return (data ?? []) as Row[];
}

export async function loadAll(): Promise<LoadedData> {
  const [
    companies, employees, clients, projects, sites, assignments,
    documents, attendance, payroll, approvals, auditLogs, profiles, roles,
  ] = await Promise.all([
    all("companies"), all("employees"), all("clients"), all("projects"), all("sites"),
    all("assignments"), all("employee_documents"), all("attendance"), all("payroll_entries"),
    all("approvals"), all("audit_logs"), all("profiles"), all("user_roles"),
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
  };
}
