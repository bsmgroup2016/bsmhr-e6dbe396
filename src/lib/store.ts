// App state store backed by Supabase.
// Data is hydrated once (see hydrateStore) into an in-memory cache so the
// existing synchronous getters keep working; every mutation writes to Supabase.
import type {
  Employee, Client, Project, Site, Assignment, EmployeeDocument,
  Attendance, PayrollEntry, Approval, AuditLog, User, AppBranch, Company,
  LeaveRequest, RateAgreement, Invoice, InvoiceLine,
} from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import {
  loadAll, toEmployee, toClient, toProject, toSite, toAssignment,
  toDocument, toAttendance, toPayroll, toApproval, toCompany, toLeave,
  toRate, toInvoice,
} from "@/lib/db";

export interface AppState {
  employees: Employee[];
  clients: Client[];
  projects: Project[];
  sites: Site[];
  assignments: Assignment[];
  documents: EmployeeDocument[];
  attendance: Attendance[];
  payroll: PayrollEntry[];
  approvals: Approval[];
  auditLogs: AuditLog[];
  leaveRequests: LeaveRequest[];
  rateAgreements: RateAgreement[];
  invoices: Invoice[];
  users: User[];
  branches: AppBranch[];
  currentBranch: string;
  companies: Company[];
  currentCompany: string;
  currentUser: User | null;
}

const defaultBranches: AppBranch[] = [
  { id: "hq", name: "Headquarters", location: "Singapore", status: "Active" },
  { id: "east", name: "East Branch", location: "Tampines", status: "Active" },
  { id: "west", name: "West Branch", location: "Jurong", status: "Active" },
];

const emptyState: AppState = {
  employees: [], clients: [], projects: [], sites: [], assignments: [], documents: [],
  attendance: [], payroll: [], approvals: [], auditLogs: [], leaveRequests: [],
  rateAgreements: [], invoices: [], users: [],
  branches: defaultBranches, currentBranch: "hq",
  companies: [], currentCompany: "", currentUser: null,
};

let state: AppState = emptyState;
const listeners = new Set<() => void>();

function getState(): AppState {
  return state;
}

function setState(next: AppState) {
  state = next;
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function fail(table: string, error: { message: string } | null) {
  if (error) console.error(`[store] ${table} write failed:`, error.message);
}

/* ---------------- hydration ---------------- */
let hydrated = false;

export function isHydrated() {
  return hydrated;
}

export async function hydrateStore(): Promise<void> {
  const data = await loadAll();
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData?.user ?? null;
  const currentUser =
    (authUser && data.users.find((u) => u.id === authUser.id)) ||
    (authUser
      ? {
          id: authUser.id,
          name: (authUser.user_metadata?.full_name as string) ?? authUser.email ?? "User",
          email: authUser.email ?? "",
          role: "admin" as User["role"],
          status: "active" as const,
          createdAt: authUser.created_at,
        }
      : null);

  const storedCompany = typeof window !== "undefined" ? localStorage.getItem("bsm-current-company") : null;
  const companyId =
    (storedCompany && data.companies.some((c) => c.id === storedCompany) && storedCompany) ||
    data.companies[0]?.id ||
    "";

  setState({
    ...emptyState,
    ...data,
    branches: defaultBranches,
    currentBranch: "hq",
    currentCompany: companyId,
    currentUser,
  });
  hydrated = true;
}

/* ---------------- employees ---------------- */
export function getEmployees(): Employee[] { return getState().employees; }
export function getEmployee(id: string): Employee | undefined { return getState().employees.find((e) => e.id === id); }

export function addEmployee(employee: Omit<Employee, "id" | "employeeCode" | "createdAt" | "updatedAt">): Employee {
  const s = getState();
  const now = new Date().toISOString();
  const nextCode = `EMP-${String(s.employees.length + 1).padStart(4, "0")}`;
  const row: Employee = { ...employee, id: newId(), employeeCode: nextCode, createdAt: now, updatedAt: now };
  setState({ ...s, employees: [row, ...s.employees] });
  void supabase.from("employees").insert({ id: row.id, ...toEmployee(row) }).then(({ error }) => fail("employees", error));
  addAuditLog("CREATE", "Employee", row.id, `Created employee ${row.name} (${row.employeeCode})`);
  return row;
}

export function updateEmployee(id: string, updates: Partial<Employee>): Employee | undefined {
  const s = getState();
  const existing = s.employees.find((e) => e.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, employees: s.employees.map((e) => (e.id === id ? updated : e)) });
  void supabase.from("employees").update(toEmployee(updated)).eq("id", id).then(({ error }) => fail("employees", error));
  addAuditLog("UPDATE", "Employee", id, `Updated employee ${updated.name} (${updated.employeeCode})`);
  return updated;
}

export function deleteEmployee(id: string): boolean {
  const s = getState();
  const employee = s.employees.find((e) => e.id === id);
  if (!employee) return false;
  setState({ ...s, employees: s.employees.filter((e) => e.id !== id) });
  void supabase.from("employees").delete().eq("id", id).then(({ error }) => fail("employees", error));
  addAuditLog("DELETE", "Employee", id, `Deleted employee ${employee.name} (${employee.employeeCode})`);
  return true;
}

/* ---------------- clients ---------------- */
export function getClients(): Client[] { return getState().clients; }
export function getClient(id: string): Client | undefined { return getState().clients.find((c) => c.id === id); }

export function addClient(client: Omit<Client, "id" | "code" | "createdAt" | "updatedAt">): Client {
  const s = getState();
  const now = new Date().toISOString();
  const row: Client = { ...client, id: newId(), code: `CLI-${String(s.clients.length + 1).padStart(3, "0")}`, createdAt: now, updatedAt: now };
  setState({ ...s, clients: [row, ...s.clients] });
  void supabase.from("clients").insert({ id: row.id, ...toClient(row) }).then(({ error }) => fail("clients", error));
  addAuditLog("CREATE", "Client", row.id, `Created client ${row.name}`);
  return row;
}

export function updateClient(id: string, updates: Partial<Client>): Client | undefined {
  const s = getState();
  const existing = s.clients.find((c) => c.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, clients: s.clients.map((c) => (c.id === id ? updated : c)) });
  void supabase.from("clients").update(toClient(updated)).eq("id", id).then(({ error }) => fail("clients", error));
  addAuditLog("UPDATE", "Client", id, `Updated client ${updated.name}`);
  return updated;
}

export function deleteClient(id: string): boolean {
  const s = getState();
  const client = s.clients.find((c) => c.id === id);
  if (!client) return false;
  setState({ ...s, clients: s.clients.filter((c) => c.id !== id) });
  void supabase.from("clients").delete().eq("id", id).then(({ error }) => fail("clients", error));
  addAuditLog("DELETE", "Client", id, `Deleted client ${client.name}`);
  return true;
}

/* ---------------- projects ---------------- */
export function getProjects(): Project[] { return getState().projects; }
export function getProject(id: string): Project | undefined { return getState().projects.find((p) => p.id === id); }

export function addProject(project: Omit<Project, "id" | "code" | "createdAt" | "updatedAt">): Project {
  const s = getState();
  const now = new Date().toISOString();
  const row: Project = { ...project, id: newId(), code: `PRJ-${String(s.projects.length + 1).padStart(3, "0")}`, createdAt: now, updatedAt: now };
  setState({ ...s, projects: [row, ...s.projects] });
  void supabase.from("projects").insert({ id: row.id, ...toProject(row) }).then(({ error }) => fail("projects", error));
  addAuditLog("CREATE", "Project", row.id, `Created project ${row.name}`);
  return row;
}

export function updateProject(id: string, updates: Partial<Project>): Project | undefined {
  const s = getState();
  const existing = s.projects.find((p) => p.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, projects: s.projects.map((p) => (p.id === id ? updated : p)) });
  void supabase.from("projects").update(toProject(updated)).eq("id", id).then(({ error }) => fail("projects", error));
  addAuditLog("UPDATE", "Project", id, `Updated project ${updated.name}`);
  return updated;
}

export function deleteProject(id: string): boolean {
  const s = getState();
  const project = s.projects.find((p) => p.id === id);
  if (!project) return false;
  setState({ ...s, projects: s.projects.filter((p) => p.id !== id) });
  void supabase.from("projects").delete().eq("id", id).then(({ error }) => fail("projects", error));
  addAuditLog("DELETE", "Project", id, `Deleted project ${project.name}`);
  return true;
}

/* ---------------- sites ---------------- */
export function getSites(): Site[] { return getState().sites; }
export function getSitesByProject(projectId: string): Site[] { return getState().sites.filter((s) => s.projectId === projectId); }

export function addSite(site: Omit<Site, "id" | "code" | "createdAt" | "updatedAt">): Site {
  const s = getState();
  const now = new Date().toISOString();
  const row: Site = { ...site, id: newId(), code: `SITE-${String(s.sites.length + 1).padStart(3, "0")}`, createdAt: now, updatedAt: now };
  setState({ ...s, sites: [row, ...s.sites] });
  void supabase.from("sites").insert({ id: row.id, ...toSite(row) }).then(({ error }) => fail("sites", error));
  addAuditLog("CREATE", "Site", row.id, `Created site ${row.name}`);
  return row;
}

export function updateSite(id: string, updates: Partial<Site>): Site | undefined {
  const s = getState();
  const existing = s.sites.find((x) => x.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, sites: s.sites.map((x) => (x.id === id ? updated : x)) });
  void supabase.from("sites").update(toSite(updated)).eq("id", id).then(({ error }) => fail("sites", error));
  addAuditLog("UPDATE", "Site", id, `Updated site ${updated.name}`);
  return updated;
}

/* ---------------- assignments ---------------- */
export function getAssignments(): Assignment[] { return getState().assignments; }
export function getAssignmentsByEmployee(employeeId: string): Assignment[] { return getState().assignments.filter((a) => a.employeeId === employeeId); }
export function getAssignment(id: string): Assignment | undefined { return getState().assignments.find((a) => a.id === id); }

export function addAssignment(assignment: Omit<Assignment, "id" | "createdAt" | "updatedAt">): Assignment {
  const s = getState();
  const now = new Date().toISOString();
  const row: Assignment = { ...assignment, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, assignments: [row, ...s.assignments] });
  void supabase.from("assignments").insert({ id: row.id, ...toAssignment(row) }).then(({ error }) => fail("assignments", error));
  addAuditLog("CREATE", "Assignment", row.id, `Created assignment for ${s.employees.find((e) => e.id === row.employeeId)?.name ?? "employee"}`);
  return row;
}

export function updateAssignment(id: string, updates: Partial<Assignment>): Assignment | undefined {
  const s = getState();
  const existing = s.assignments.find((a) => a.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, assignments: s.assignments.map((a) => (a.id === id ? updated : a)) });
  void supabase.from("assignments").update(toAssignment(updated)).eq("id", id).then(({ error }) => fail("assignments", error));
  addAuditLog("UPDATE", "Assignment", id, `Updated assignment for ${s.employees.find((e) => e.id === updated.employeeId)?.name ?? "employee"}`);
  return updated;
}

/* ---------------- documents ---------------- */
export function getDocuments(): EmployeeDocument[] { return getState().documents; }
export function getDocumentsByEmployee(employeeId: string): EmployeeDocument[] { return getState().documents.filter((d) => d.employeeId === employeeId); }

export function addDocument(document: Omit<EmployeeDocument, "id" | "uploadedAt" | "updatedAt">): EmployeeDocument {
  const s = getState();
  const now = new Date().toISOString();
  const row: EmployeeDocument = { ...document, id: newId(), uploadedAt: now, updatedAt: now };
  setState({ ...s, documents: [row, ...s.documents] });
  void supabase.from("employee_documents").insert({ id: row.id, ...toDocument(row) }).then(({ error }) => fail("employee_documents", error));
  addAuditLog("CREATE", "Document", row.id, `Created document ${row.name}`);
  return row;
}

export function updateDocument(id: string, updates: Partial<EmployeeDocument>): EmployeeDocument | undefined {
  const s = getState();
  const existing = s.documents.find((d) => d.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, documents: s.documents.map((d) => (d.id === id ? updated : d)) });
  void supabase.from("employee_documents").update(toDocument(updated)).eq("id", id).then(({ error }) => fail("employee_documents", error));
  addAuditLog("UPDATE", "Document", id, `Updated document ${updated.name}`);
  return updated;
}

export function deleteDocument(id: string): boolean {
  const s = getState();
  const doc = s.documents.find((d) => d.id === id);
  if (!doc) return false;
  setState({ ...s, documents: s.documents.filter((d) => d.id !== id) });
  void supabase.from("employee_documents").delete().eq("id", id).then(({ error }) => fail("employee_documents", error));
  addAuditLog("DELETE", "Document", id, `Deleted document ${doc.name}`);
  return true;
}

/* ---------------- attendance ---------------- */
export function getAttendance(): Attendance[] { return getState().attendance; }
export function getAttendanceByEmployee(employeeId: string): Attendance[] { return getState().attendance.filter((a) => a.employeeId === employeeId); }

export function addAttendance(attendance: Omit<Attendance, "id" | "createdAt" | "updatedAt">): Attendance {
  const s = getState();
  const now = new Date().toISOString();
  const row: Attendance = { ...attendance, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, attendance: [row, ...s.attendance] });
  void supabase.from("attendance").upsert({ id: row.id, ...toAttendance(row) }, { onConflict: "employee_id,date" })
    .then(({ error }) => fail("attendance", error));
  addAuditLog("CREATE", "Attendance", row.id, `Attendance recorded for ${s.employees.find((e) => e.id === row.employeeId)?.name ?? "employee"}`);
  return row;
}

export function updateAttendance(id: string, updates: Partial<Attendance>): Attendance | undefined {
  const s = getState();
  const existing = s.attendance.find((a) => a.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, attendance: s.attendance.map((a) => (a.id === id ? updated : a)) });
  void supabase.from("attendance").update(toAttendance(updated)).eq("id", id)
    .then(({ error }) => fail("attendance", error));
  return updated;
}

/** Insert or update the single attendance record for an employee on a date. */
export function upsertAttendance(record: Omit<Attendance, "id" | "createdAt" | "updatedAt">): Attendance {
  const existing = getState().attendance.find(
    (a) => a.employeeId === record.employeeId && a.date === record.date,
  );
  if (existing) return updateAttendance(existing.id, record) ?? existing;
  return addAttendance(record);
}

/** Bulk daily marking from the site attendance sheet. */
export function saveDailySheet(
  rows: Omit<Attendance, "id" | "createdAt" | "updatedAt">[],
): { saved: number } {
  rows.forEach((row) => upsertAttendance(row));
  return { saved: rows.length };
}

/* ---------------- payroll ---------------- */
export function getPayroll(): PayrollEntry[] { return getState().payroll; }
export function getPayrollByEmployee(employeeId: string): PayrollEntry[] { return getState().payroll.filter((p) => p.employeeId === employeeId); }

export function addPayroll(payroll: Omit<PayrollEntry, "id" | "createdAt" | "updatedAt">): PayrollEntry {
  const s = getState();
  const now = new Date().toISOString();
  const row: PayrollEntry = { ...payroll, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, payroll: [row, ...s.payroll] });
  void supabase.from("payroll_entries").upsert({ id: row.id, ...toPayroll(row) }, { onConflict: "employee_id,month" })
    .then(({ error }) => fail("payroll_entries", error));
  addAuditLog("CREATE", "Payroll", row.id, `Payroll entry for ${s.employees.find((e) => e.id === row.employeeId)?.name ?? "employee"}`);
  return row;
}

export function updatePayroll(id: string, updates: Partial<PayrollEntry>): PayrollEntry | undefined {
  const s = getState();
  const existing = s.payroll.find((p) => p.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, payroll: s.payroll.map((p) => (p.id === id ? updated : p)) });
  void supabase.from("payroll_entries").update(toPayroll(updated)).eq("id", id).then(({ error }) => fail("payroll_entries", error));
  addAuditLog("UPDATE", "Payroll", id, `Payroll ${updated.month} set to ${updated.status}`);
  return updated;
}

export function deletePayroll(id: string): boolean {
  const s = getState();
  const row = s.payroll.find((p) => p.id === id);
  if (!row) return false;
  setState({ ...s, payroll: s.payroll.filter((p) => p.id !== id) });
  void supabase.from("payroll_entries").delete().eq("id", id).then(({ error }) => fail("payroll_entries", error));
  addAuditLog("DELETE", "Payroll", id, `Deleted payroll entry ${row.month}`);
  return true;
}

/** Singapore CPF: only for Singaporean/PR staff. Foreign pass holders pay levy instead. */
export function computeCpf(employee: Employee, grossWage: number) {
  if (employee.passType !== "Singaporean/PR") return { cpfEmployee: 0, cpfEmployer: 0 };
  const capped = Math.min(grossWage, 7400);
  return {
    cpfEmployee: Math.round(capped * 0.2),
    cpfEmployer: Math.round(capped * 0.17),
  };
}

/** Auto-build payroll drafts for a month from employee salary + attendance OT. */
export function generatePayrollForMonth(month: string, companyId?: string): { created: number; skipped: number } {
  const s = getState();
  const staff = s.employees.filter(
    (e) => e.status !== "Inactive" && (!companyId || e.companyId === companyId),
  );
  let created = 0;
  let skipped = 0;

  for (const emp of staff) {
    if (s.payroll.some((p) => p.employeeId === emp.id && p.month === month)) {
      skipped += 1;
      continue;
    }
    const rows = s.attendance.filter((a) => a.employeeId === emp.id && a.date.startsWith(month));
    const otHours = rows.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
    const basicSalary = emp.basicSalary || 0;
    const hourlyRate = basicSalary / 26 / 8;
    const overtimePay = Math.round(otHours * hourlyRate * 1.5);
    const levies = Math.round(emp.levyRate ?? 0);
    const { cpfEmployee, cpfEmployer } = computeCpf(emp, basicSalary + overtimePay);
    addPayroll({
      employeeId: emp.id,
      month,
      basicSalary,
      overtimePay,
      allowances: 0,
      deductions: 0,
      cpfEmployee,
      cpfEmployer,
      levies,
      netPay: basicSalary + overtimePay - cpfEmployee,
      status: "Draft",
    });
    created += 1;
  }
  return { created, skipped };
}

/* ---------------- approvals ---------------- */
export function getLeaveRequests(): LeaveRequest[] { return getState().leaveRequests; }
export function getLeaveByEmployee(employeeId: string): LeaveRequest[] {
  return getState().leaveRequests.filter((l) => l.employeeId === employeeId);
}

/** Inclusive day count between two ISO dates. */
export function countLeaveDays(startDate: string, endDate: string): number {
  const a = new Date(startDate).getTime();
  const b = new Date(endDate).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;
}

export function addLeaveRequest(
  leave: Omit<LeaveRequest, "id" | "createdAt" | "updatedAt" | "days"> & { days?: number },
): LeaveRequest {
  const s = getState();
  const now = new Date().toISOString();
  const row: LeaveRequest = {
    ...leave,
    days: leave.days ?? countLeaveDays(leave.startDate, leave.endDate),
    id: newId(),
    createdAt: now,
    updatedAt: now,
  };
  setState({ ...s, leaveRequests: [row, ...s.leaveRequests] });
  void supabase.from("leave_requests").insert({ id: row.id, ...toLeave(row) })
    .then(({ error }) => fail("leave_requests", error));
  const emp = s.employees.find((e) => e.id === row.employeeId);
  addApproval({
    type: "Leave",
    title: `${row.type} — ${emp?.name ?? "Employee"} (${row.days} day${row.days === 1 ? "" : "s"})`,
    requestedBy: s.currentUser?.id ?? "",
    requestedByName: s.currentUser?.name ?? "System",
    requestedAt: now,
    status: "Pending",
    payload: `Employee: ${emp?.employeeCode ?? row.employeeId}\nType: ${row.type}\nFrom: ${row.startDate}\nTo: ${row.endDate}\nReason: ${row.reason ?? "-"}`,
  });
  addAuditLog("CREATE", "Leave", row.id, `Leave request ${row.type} for ${emp?.name ?? "employee"}`);
  return row;
}

export function updateLeaveRequest(id: string, updates: Partial<LeaveRequest>): LeaveRequest | undefined {
  const s = getState();
  const existing = s.leaveRequests.find((l) => l.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, leaveRequests: s.leaveRequests.map((l) => (l.id === id ? updated : l)) });
  void supabase.from("leave_requests").update(toLeave(updated)).eq("id", id)
    .then(({ error }) => fail("leave_requests", error));
  addAuditLog("UPDATE", "Leave", id, `Leave request set to ${updated.status}`);
  return updated;
}

export function deleteLeaveRequest(id: string): boolean {
  const s = getState();
  if (!s.leaveRequests.some((l) => l.id === id)) return false;
  setState({ ...s, leaveRequests: s.leaveRequests.filter((l) => l.id !== id) });
  void supabase.from("leave_requests").delete().eq("id", id).then(({ error }) => fail("leave_requests", error));
  addAuditLog("DELETE", "Leave", id, "Deleted leave request");
  return true;
}

/** Approve leave and push the days into attendance as On Leave / MC. */
export function approveLeaveRequest(id: string): LeaveRequest | undefined {
  const s = getState();
  const leave = s.leaveRequests.find((l) => l.id === id);
  if (!leave) return undefined;
  const user = s.currentUser;
  const updated = updateLeaveRequest(id, {
    status: "Approved",
    approvedBy: user?.id,
    approvedAt: new Date().toISOString(),
  });
  const attendanceStatus =
    leave.type === "Medical Leave" || leave.type === "Hospitalisation Leave" ? "MC" : "On Leave";
  const start = new Date(leave.startDate);
  const end = new Date(leave.endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    upsertAttendance({
      employeeId: leave.employeeId,
      date: d.toISOString().slice(0, 10),
      status: attendanceStatus,
      hoursWorked: 0,
      overtimeHours: 0,
      notes: `${leave.type}${leave.reason ? ` — ${leave.reason}` : ""}`,
    });
  }
  return updated;
}

/* ---------------- approvals ---------------- */
export function getApprovals(): Approval[] { return getState().approvals; }

export function getApproval(id: string): Approval | undefined { return getState().approvals.find((a) => a.id === id); }

export function addApproval(approval: Omit<Approval, "id" | "createdAt" | "updatedAt">): Approval {
  const s = getState();
  const now = new Date().toISOString();
  const row: Approval = { ...approval, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, approvals: [row, ...s.approvals] });
  void supabase.from("approvals").insert({ id: row.id, requested_at: row.requestedAt, ...toApproval(row) })
    .then(({ error }) => fail("approvals", error));
  addAuditLog("CREATE", "Approval", row.id, `Created approval request ${row.title}`);
  return row;
}

export function updateApproval(id: string, updates: Partial<Approval>): Approval | undefined {
  const s = getState();
  const existing = s.approvals.find((a) => a.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, approvals: s.approvals.map((a) => (a.id === id ? updated : a)) });
  void supabase.from("approvals").update(toApproval(updated)).eq("id", id).then(({ error }) => fail("approvals", error));
  addAuditLog("UPDATE", "Approval", id, `Updated approval request ${updated.title}`);
  return updated;
}

/* ---------------- audit logs ---------------- */
export function getAuditLogs(): AuditLog[] { return getState().auditLogs; }

export function addAuditLog(action: string, entityType: string, entityId: string, details: string): AuditLog {
  const s = getState();
  const user = s.currentUser;
  const log: AuditLog = {
    id: newId(), action, entityType, entityId,
    userId: user?.id ?? "", userName: user?.name ?? "System",
    timestamp: new Date().toISOString(), details,
  };
  setState({ ...getState(), auditLogs: [log, ...getState().auditLogs] });
  void supabase.from("audit_logs").insert({
    id: log.id, action, entity_type: entityType, entity_id: entityId,
    user_id: user?.id ?? null, user_name: log.userName, details: { text: details },
  }).then(({ error }) => fail("audit_logs", error));
  return log;
}

/* ---------------- users / branches / companies ---------------- */
export function getUsers(): User[] { return getState().users; }
export function getCurrentUser(): User | null { return getState().currentUser; }
export function getBranches(): AppBranch[] { return getState().branches; }
export function getCurrentBranch(): string { return getState().currentBranch; }
export function setCurrentBranch(branchId: string) { setState({ ...getState(), currentBranch: branchId }); }

export function getCompanies(): Company[] { return getState().companies; }
export function getCompany(id: string): Company | undefined { return getCompanies().find((c) => c.id === id); }
export function getCurrentCompany(): string { return getState().currentCompany; }

export function setCurrentCompany(companyId: string) {
  setState({ ...getState(), currentCompany: companyId });
  if (typeof window !== "undefined") {
    localStorage.setItem("bsm-current-company", companyId);
    window.dispatchEvent(new CustomEvent("bsm:company-changed", { detail: companyId }));
  }
}

export function addCompany(company: Omit<Company, "id" | "createdAt" | "updatedAt">): Company {
  const s = getState();
  const now = new Date().toISOString();
  const row: Company = { ...company, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, companies: [...s.companies, row] });
  void supabase.from("companies").insert({ id: row.id, ...toCompany(row) }).then(({ error }) => fail("companies", error));
  addAuditLog("CREATE", "Company", row.id, `Created company ${row.name}`);
  return row;
}

export function updateCompany(id: string, updates: Partial<Company>): Company | undefined {
  const s = getState();
  const existing = s.companies.find((c) => c.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, companies: s.companies.map((c) => (c.id === id ? updated : c)) });
  void supabase.from("companies").update(toCompany(updated)).eq("id", id).then(({ error }) => fail("companies", error));
  addAuditLog("UPDATE", "Company", id, `Updated company ${updated.name}`);
  return updated;
}

export function deleteCompany(id: string) {
  const s = getState();
  const target = s.companies.find((c) => c.id === id);
  const remaining = s.companies.filter((c) => c.id !== id);
  setState({
    ...s,
    companies: remaining,
    currentCompany: s.currentCompany === id ? (remaining[0]?.id ?? "") : s.currentCompany,
  });
  void supabase.from("companies").delete().eq("id", id).then(({ error }) => fail("companies", error));
  if (target) addAuditLog("DELETE", "Company", id, `Deleted company ${target.name}`);
}

export async function resetState() {
  await hydrateStore();
}

export function exportState(): string {
  return JSON.stringify(getState(), null, 2);
}

export function importState(json: string) {
  const parsed = JSON.parse(json) as Partial<AppState>;
  setState({ ...getState(), ...parsed });
}
