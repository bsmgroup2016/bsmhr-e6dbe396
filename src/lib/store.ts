// App state store backed by Supabase.
// Data is hydrated once (see hydrateStore) into an in-memory cache so the
// existing synchronous getters keep working; every mutation writes to Supabase.
import type {
  Employee, Client, Project, Site, Assignment, EmployeeDocument,
  Attendance, PayrollEntry, Approval, AuditLog, User, AppBranch, Company,
  LeaveRequest, RateAgreement, Invoice, InvoiceLine,
  Dormitory, BedAllocation, Vehicle, Trip,
  Asset, AssetIssuance,
} from "@/lib/types";
import type { TrainingCourse, TrainingRecord, SafetyIncident } from "@/lib/types";
import type { JobRequisition, Candidate } from "@/lib/types";
import type { Lead, CrmActivity } from "@/lib/types";
import type { Expense, PaymentReceipt } from "@/lib/types";
import type { InventoryItem, StockMovement, PurchaseOrder } from "@/lib/types";
import type { BranchPrefix, EmployeeCertification, TimeCard, ClaimSheet } from "@/lib/types";
import type { ClientContract } from "@/lib/types";
import type { MedicalClaim, EmployeeLoan, LoanRepayment, ManpowerRequest, ManpowerRequestItem } from "@/lib/types";
import { supabase } from "@/integrations/supabase/client";
import { computeStatutory, round2 } from "@/lib/sg-payroll";
import {
  loadAll, toEmployee, toClient, toProject, toSite, toAssignment,
  toDocument, toAttendance, toPayroll, toApproval, toCompany, toLeave,
  toRate, toInvoice,
  toDormitory, toAllocation, toVehicle, toTrip,
  toAsset, toIssuance,
} from "@/lib/db";
import { toCourse, toTraining, toIncident } from "@/lib/db";
import { toRequisition, toCandidate } from "@/lib/db";
import { toLead, toActivity } from "@/lib/db";
import { toExpense, toPaymentReceipt } from "@/lib/db";
import { toItem, toMovement, toPurchaseOrder } from "@/lib/db";
import { toBranchPrefix, toCertification, toTimeCard, toClaimSheet } from "@/lib/db";
import { toContract } from "@/lib/db";
import { toMedicalClaim, toLoan, toLoanRepayment, fromManpowerRequest, toManpowerRequest, fromManpowerRequestItem, toManpowerRequestItem } from "@/lib/db";
import { toDepartment, toDesignation } from "@/lib/db";
import type { Department, Designation } from "@/lib/types";
import type { DriverProfile, DriverIncident, FuelLog } from "@/lib/types";
import { toDriverProfile, toDriverIncident, toFuelLog } from "@/lib/db";

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
  dormitories: Dormitory[];
  allocations: BedAllocation[];
  vehicles: Vehicle[];
  trips: Trip[];
  assets: Asset[];
  issuances: AssetIssuance[];
  inventory: InventoryItem[];
  movements: StockMovement[];
  purchaseOrders: PurchaseOrder[];
  courses: TrainingCourse[];
  trainings: TrainingRecord[];
  incidents: SafetyIncident[];
  requisitions: JobRequisition[];
  candidates: Candidate[];
  leads: Lead[];
  activities: CrmActivity[];
  expenses: Expense[];
  receipts: PaymentReceipt[];
  users: User[];
  branchPrefixes: BranchPrefix[];
  certifications: EmployeeCertification[];
  timeCards: TimeCard[];
  claimSheets: ClaimSheet[];
  contracts: ClientContract[];
  medicalClaims: MedicalClaim[];
  loans: EmployeeLoan[];
  loanRepayments: LoanRepayment[];
  departments: Department[];
  designations: Designation[];
  driverProfiles: DriverProfile[];
  driverIncidents: DriverIncident[];
  fuelLogs: FuelLog[];
  branches: AppBranch[];
  currentBranch: string;
  companies: Company[];
  currentCompany: string;
  currentUser: User | null;
  manpowerRequests: ManpowerRequest[];
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
  dormitories: [], allocations: [], vehicles: [], trips: [],
  assets: [], issuances: [],
  courses: [], trainings: [], incidents: [],
  requisitions: [], candidates: [],
  leads: [], activities: [],
  expenses: [], receipts: [],
  inventory: [], movements: [], purchaseOrders: [],
  branchPrefixes: [], certifications: [], timeCards: [], claimSheets: [],
  contracts: [],
  medicalClaims: [],
  loans: [], loanRepayments: [],
  departments: [], designations: [],
  driverProfiles: [], driverIncidents: [], fuelLogs: [],
  branches: defaultBranches, currentBranch: "hq",
  companies: [], currentCompany: "", currentUser: null, manpowerRequests: [],
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
  const nextCode =
    (employee as Partial<Employee>).employeeCode?.trim() ||
    nextEmployeeCode(employee.branch ?? "");
  const row: Employee = { ...employee, id: newId(), employeeCode: nextCode, createdAt: now, updatedAt: now };
  setState({ ...s, employees: [row, ...s.employees] });
  void supabase.from("employees").insert({ id: row.id, ...toEmployee(row) }).then(({ error }) => fail("employees", error));
  addAuditLog("CREATE", "Employee", row.id, `Created employee ${row.name} (${row.employeeCode})`);
  return row;
}

/* ------- branch-prefixed employee IDs (BS1, V1, P1 …) ------- */
export function getBranchPrefixes(): BranchPrefix[] {
  return getState().branchPrefixes.filter((b) => b.active);
}
export function getAllBranchPrefixes(): BranchPrefix[] { return getState().branchPrefixes; }

export function addBranchPrefix(x: Omit<BranchPrefix, "id" | "createdAt" | "updatedAt">): BranchPrefix {
  const s = getState();
  const row: BranchPrefix = { ...x, code: x.code.toUpperCase(), id: newId() };
  setState({ ...s, branchPrefixes: [...s.branchPrefixes, row] });
  void supabase.from("branch_prefixes").insert({ id: row.id, ...toBranchPrefix(row) }).then(({ error }) => fail("branch_prefixes", error));
  addAuditLog("CREATE", "BranchPrefix", row.id, `Added branch prefix ${row.code} (${row.name})`);
  return row;
}

export function updateBranchPrefix(id: string, updates: Partial<BranchPrefix>): BranchPrefix | undefined {
  const s = getState();
  const existing = s.branchPrefixes.find((b) => b.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, code: (updates.code ?? existing.code).toUpperCase() };
  setState({ ...s, branchPrefixes: s.branchPrefixes.map((b) => (b.id === id ? updated : b)) });
  void supabase.from("branch_prefixes").update(toBranchPrefix(updated)).eq("id", id).then(({ error }) => fail("branch_prefixes", error));
  addAuditLog("UPDATE", "BranchPrefix", id, `Updated branch prefix ${updated.code}`);
  return updated;
}

export function deleteBranchPrefix(id: string): boolean {
  const s = getState();
  const row = s.branchPrefixes.find((b) => b.id === id);
  if (!row) return false;
  setState({ ...s, branchPrefixes: s.branchPrefixes.filter((b) => b.id !== id) });
  void supabase.from("branch_prefixes").delete().eq("id", id).then(({ error }) => fail("branch_prefixes", error));
  addAuditLog("DELETE", "BranchPrefix", id, `Removed branch prefix ${row.code}`);
  return true;
}

/** Resolve the prefix for a branch/company key. Falls back to the "X" unassigned prefix. */
export function prefixForBranch(branch?: string): string {
  const list = getState().branchPrefixes;
  if (!list.length) return "X";
  const key = (branch ?? "").trim().toLowerCase();
  const match =
    list.find((b) => b.code.toLowerCase() === key) ||
    list.find((b) => b.name.toLowerCase() === key) ||
    list.find((b) => key && b.name.toLowerCase().includes(key)) ||
    list.find((b) => key && key.includes(b.name.toLowerCase()));
  return (match?.code ?? list.find((b) => b.code === "X")?.code ?? list[0].code).toUpperCase();
}

/** Sequence part of a P-File Number is always zero padded to 2 digits. */
const CODE_PAD = 2;

/** Build a P-File Number, e.g. ("V", 1) -> "V-01", ("BS", 11) -> "BS-11". */
export function formatEmployeeCode(prefix: string, seq: number): string {
  const p = prefix.toUpperCase();
  return `${p}-${String(seq).padStart(CODE_PAD, "0")}`;
}

/** Compare P-File Numbers ignoring dashes, spaces and leading zeros. */
export function normalizeEmployeeCode(code: string): string {
  const m = /^([a-z]+)[^a-z0-9]*0*(\d+)$/i.exec((code ?? "").trim());
  return m ? `${m[1].toUpperCase()}${Number(m[2])}` : (code ?? "").trim().toUpperCase();
}

/** Next free sequential P-File Number for a branch prefix — V-01, V-02 … */
export function nextEmployeeCode(branch?: string): string {
  const prefix = prefixForBranch(branch);
  const re = new RegExp(`^${prefix}[^a-z0-9]*(\\d+)$`, "i");
  let max = 0;
  for (const e of getState().employees) {
    const m = re.exec((e.employeeCode ?? "").trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return formatEmployeeCode(prefix, max + 1);
}

export function isEmployeeCodeTaken(code: string, exceptId?: string): boolean {
  const key = normalizeEmployeeCode(code);
  return getState().employees.some(
    (e) => e.id !== exceptId && normalizeEmployeeCode(e.employeeCode ?? "") === key,
  );
}

/**
 * Rename a P-File Number. All related records (attendance, payroll, documents,
 * assignments) reference the employee row's UUID, so this is a safe metadata
 * rename — nothing is re-created or orphaned.
 */
export function changeEmployeeCode(
  id: string,
  newCode: string,
  reason: string,
): { ok: boolean; error?: string } {
  const employee = getEmployee(id);
  if (!employee) return { ok: false, error: "Employee not found" };
  const code = newCode.trim();
  if (!code) return { ok: false, error: "P-File Number cannot be empty" };
  if (isEmployeeCodeTaken(code, id)) return { ok: false, error: `P-File Number ${code} already exists` };
  const old = employee.employeeCode;
  updateEmployee(id, { employeeCode: code });
  addAuditLog(
    "RENAME", "Employee", id,
    `P-File Number changed ${old} → ${code}. Reason: ${reason || "not provided"}`,
  );
  return { ok: true };
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
  releaseEmployeeIfUnassigned(updated.employeeId);
  return updated;
}

/**
 * When a worker is taken off a project (assignment ended / rejected /
 * transferred) and has no other active assignment left, they go back to the
 * available pool automatically.
 */
export function releaseEmployeeIfUnassigned(employeeId: string) {
  const s = getState();
  const stillAssigned = s.assignments.some(
    (a) => a.employeeId === employeeId && (a.status === "Active" || a.status === "Approved"),
  );
  if (stillAssigned) return;
  const emp = s.employees.find((e) => e.id === employeeId);
  if (!emp) return;
  const deploy = emp.deploymentStatus ?? "Available";
  if (deploy === "Blocked" || deploy === "Not Deployable" || deploy === "On Leave") return;
  const patch: Partial<Employee> = {};
  if (deploy !== "Available") patch.deploymentStatus = "Available";
  if (emp.status === "Deployed") patch.status = "Active";
  if (Object.keys(patch).length) updateEmployee(employeeId, patch);
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
export function deleteAttendance(id: string): boolean {
  const s = getState();
  const existing = s.attendance.find((a) => a.id === id);
  if (!existing) return false;
  setState({ ...s, attendance: s.attendance.filter((a) => a.id !== id) });
  void supabase.from("attendance").delete().eq("id", id)
    .then(({ error }) => fail("attendance", error));
  addAuditLog("DELETE", "Attendance", id, `Attendance deleted for ${existing.date}`);
  return true;
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
  const { cpfEmployee, cpfEmployer } = computeStatutory(employee, grossWage);
  return { cpfEmployee, cpfEmployer };
}

export { computeStatutory };

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
    const gross = basicSalary + overtimePay;
    const stat = computeStatutory(emp, gross);
    addPayroll({
      employeeId: emp.id,
      month,
      basicSalary,
      overtimePay,
      allowances: 0,
      deductions: 0,
      cpfEmployee: stat.cpfEmployee,
      cpfEmployer: stat.cpfEmployer,
      levies: stat.levy,
      sdl: stat.sdl,
      shgFund: stat.shgFund,
      shgAmount: stat.shgAmount,
      employerCost: stat.employerCost,
      netPay: round2(gross - stat.cpfEmployee - stat.shgAmount),
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

/* ---------------- billing: rate agreements ---------------- */
export function getRateAgreements(): RateAgreement[] { return getState().rateAgreements; }

export function addRateAgreement(rate: Omit<RateAgreement, "id" | "createdAt" | "updatedAt">): RateAgreement {
  const s = getState();
  const now = new Date().toISOString();
  const row: RateAgreement = { ...rate, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, rateAgreements: [row, ...s.rateAgreements] });
  void supabase.from("rate_agreements").insert({ id: row.id, ...toRate(row) })
    .then(({ error }) => fail("rate_agreements", error));
  addAuditLog("CREATE", "RateAgreement", row.id, `Rate ${row.trade} @ ${row.normalRate}/${row.unit}`);
  return row;
}

export function updateRateAgreement(id: string, updates: Partial<RateAgreement>): RateAgreement | undefined {
  const s = getState();
  const existing = s.rateAgreements.find((r) => r.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, rateAgreements: s.rateAgreements.map((r) => (r.id === id ? updated : r)) });
  void supabase.from("rate_agreements").update(toRate(updated)).eq("id", id)
    .then(({ error }) => fail("rate_agreements", error));
  addAuditLog("UPDATE", "RateAgreement", id, `Updated rate ${updated.trade}`);
  return updated;
}

export function deleteRateAgreement(id: string): boolean {
  const s = getState();
  if (!s.rateAgreements.some((r) => r.id === id)) return false;
  setState({ ...s, rateAgreements: s.rateAgreements.filter((r) => r.id !== id) });
  void supabase.from("rate_agreements").delete().eq("id", id).then(({ error }) => fail("rate_agreements", error));
  addAuditLog("DELETE", "RateAgreement", id, "Deleted rate agreement");
  return true;
}

/** Best matching rate for a trade on a client/project at a given date. */
export function findRate(
  clientId: string,
  trade: string,
  projectId?: string,
  onDate = new Date().toISOString().slice(0, 10),
): RateAgreement | undefined {
  const active = getState().rateAgreements.filter(
    (r) =>
      r.clientId === clientId &&
      r.status === "Active" &&
      (!r.effectiveFrom || r.effectiveFrom <= onDate) &&
      (!r.effectiveTo || r.effectiveTo >= onDate) &&
      (r.trade === trade || r.trade === "All"),
  );
  return (
    active.find((r) => r.projectId === projectId && r.trade === trade) ??
    active.find((r) => r.projectId === projectId) ??
    active.find((r) => !r.projectId && r.trade === trade) ??
    active.find((r) => !r.projectId)
  );
}

/* ---------------- billing: invoices ---------------- */
export function getInvoices(): Invoice[] { return getState().invoices; }
export function getInvoice(id: string): Invoice | undefined { return getState().invoices.find((i) => i.id === id); }

function nextInvoiceNo(): string {
  const year = new Date().getFullYear();
  const count = getState().invoices.filter((i) => i.invoiceNo.includes(`-${year}-`)).length + 1;
  return `INV-${year}-${String(count).padStart(4, "0")}`;
}

export function computeInvoiceTotals(lines: InvoiceLine[], gstRate: number) {
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const gstAmount = Math.round(subtotal * (gstRate / 100) * 100) / 100;
  return { subtotal: Math.round(subtotal * 100) / 100, gstAmount, total: Math.round((subtotal + gstAmount) * 100) / 100 };
}

export function addInvoice(
  invoice: Omit<Invoice, "id" | "invoiceNo" | "subtotal" | "gstAmount" | "total" | "createdAt" | "updatedAt"> &
    Partial<Pick<Invoice, "invoiceNo">>,
): Invoice {
  const s = getState();
  const now = new Date().toISOString();
  const totals = computeInvoiceTotals(invoice.lines, invoice.gstRate);
  const row: Invoice = {
    ...invoice,
    ...totals,
    invoiceNo: invoice.invoiceNo ?? nextInvoiceNo(),
    id: newId(),
    createdAt: now,
    updatedAt: now,
  };
  setState({ ...s, invoices: [row, ...s.invoices] });
  void supabase.from("invoices").insert({ id: row.id, ...toInvoice(row) })
    .then(({ error }) => fail("invoices", error));
  addAuditLog("CREATE", "Invoice", row.id, `Invoice ${row.invoiceNo} — $${row.total.toFixed(2)}`);
  return row;
}

export function updateInvoice(id: string, updates: Partial<Invoice>): Invoice | undefined {
  const s = getState();
  const existing = s.invoices.find((i) => i.id === id);
  if (!existing) return undefined;
  const merged = { ...existing, ...updates };
  const totals = computeInvoiceTotals(merged.lines, merged.gstRate);
  const updated: Invoice = { ...merged, ...totals, updatedAt: new Date().toISOString() };
  setState({ ...s, invoices: s.invoices.map((i) => (i.id === id ? updated : i)) });
  void supabase.from("invoices").update(toInvoice(updated)).eq("id", id)
    .then(({ error }) => fail("invoices", error));
  addAuditLog("UPDATE", "Invoice", id, `Invoice ${updated.invoiceNo} set to ${updated.status}`);
  return updated;
}

export function deleteInvoice(id: string): boolean {
  const s = getState();
  if (!s.invoices.some((i) => i.id === id)) return false;
  setState({ ...s, invoices: s.invoices.filter((i) => i.id !== id) });
  void supabase.from("invoices").delete().eq("id", id).then(({ error }) => fail("invoices", error));
  addAuditLog("DELETE", "Invoice", id, "Deleted invoice");
  return true;
}

export function recordInvoicePayment(id: string, amount: number): Invoice | undefined {
  const inv = getInvoice(id);
  if (!inv) return undefined;
  const paid = Math.round((inv.amountPaid + amount) * 100) / 100;
  const status: Invoice["status"] = paid >= inv.total ? "Paid" : paid > 0 ? "Partially Paid" : inv.status;
  return updateInvoice(id, { amountPaid: paid, status });
}

/**
 * Build invoice lines from attendance in a period for workers deployed to a
 * client's project sites, priced with the matching rate agreements.
 */
export function buildInvoiceLines(
  clientId: string,
  periodStart: string,
  periodEnd: string,
  projectId?: string,
): InvoiceLine[] {
  const s = getState();
  const projects = s.projects.filter((p) => p.clientId === clientId && (!projectId || p.id === projectId));
  const projectIds = new Set(projects.map((p) => p.id));
  const siteIds = new Set(s.sites.filter((si) => projectIds.has(si.projectId)).map((si) => si.id));

  const empIds = new Set(
    s.assignments
      .filter((a) => siteIds.has(a.siteId) && a.status !== "Rejected" && a.startDate <= periodEnd)
      .map((a) => a.employeeId),
  );

  const lines: InvoiceLine[] = [];
  for (const empId of empIds) {
    const emp = s.employees.find((e) => e.id === empId);
    if (!emp) continue;
    const records = s.attendance.filter(
      (a) => a.employeeId === empId && a.date >= periodStart && a.date <= periodEnd,
    );
    if (records.length === 0) continue;
    const hours = records.reduce((sum, a) => sum + (a.hoursWorked || 0), 0);
    const otHours = records.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
    const days = records.filter((a) => a.status === "Present" || a.status === "Half Day").length;
    if (hours === 0 && otHours === 0 && days === 0) continue;

    const rate = findRate(clientId, emp.trade, projectId, periodEnd);
    const unit = rate?.unit ?? "Hourly";
    const normalRate = rate?.normalRate ?? 0;
    const otRate = rate?.otRate ?? 0;
    const quantity = unit === "Hourly" ? hours : unit === "Daily" ? days : 1;
    const amount = Math.round((quantity * normalRate + otHours * otRate) * 100) / 100;

    lines.push({
      id: newId(),
      invoiceId: "", // Linked later during addInvoice
      description: `${emp.name} (${emp.employeeCode}) — ${emp.trade || "Worker"}`,
      employeeId: emp.id,
      trade: emp.trade,
      unit,
      quantity: Math.round(quantity * 100) / 100,
      rate: normalRate,
      otQuantity: Math.round(otHours * 100) / 100,
      otRate,
      amount,
      createdAt: new Date().toISOString(),
    });
  }
  return lines.sort((a, b) => b.amount - a.amount);
}

/* ---------------- billing: client contracts (recurring auto-invoicing) ---------------- */
export function getContracts(): ClientContract[] { return getState().contracts; }

/* ---------------- medical claims (FWMI / WICA) ---------------- */
export function getMedicalClaims(): MedicalClaim[] { return getState().medicalClaims; }

export function addMedicalClaim(
  claim: Omit<MedicalClaim, "id" | "claimNo" | "createdAt" | "updatedAt"> & { claimNo?: string },
): MedicalClaim {
  const s = getState();
  const now = new Date().toISOString();
  const claimNo = claim.claimNo?.trim() || `MC-${String(s.medicalClaims.length + 1).padStart(4, "0")}`;
  const row: MedicalClaim = { ...claim, claimNo, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, medicalClaims: [row, ...s.medicalClaims] });
  void supabase.from("medical_claims").insert({ id: row.id, ...toMedicalClaim(row) })
    .then(({ error }) => fail("medical_claims", error));
  addAuditLog("CREATE", "MedicalClaim", row.id, `Medical claim ${claimNo} — $${row.totalAmount}`);
  return row;
}

export function updateMedicalClaim(id: string, updates: Partial<MedicalClaim>): MedicalClaim | undefined {
  const s = getState();
  const existing = s.medicalClaims.find((c) => c.id === id);
  if (!existing) return undefined;
  const updated: MedicalClaim = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, medicalClaims: s.medicalClaims.map((c) => (c.id === id ? updated : c)) });
  void supabase.from("medical_claims").update(toMedicalClaim(updated)).eq("id", id)
    .then(({ error }) => fail("medical_claims", error));
  addAuditLog("UPDATE", "MedicalClaim", id, `Medical claim ${updated.claimNo} updated`);
  return updated;
}

export function deleteMedicalClaim(id: string): boolean {
  const s = getState();
  if (!s.medicalClaims.some((c) => c.id === id)) return false;
  setState({ ...s, medicalClaims: s.medicalClaims.filter((c) => c.id !== id) });
  void supabase.from("medical_claims").delete().eq("id", id)
    .then(({ error }) => fail("medical_claims", error));
  addAuditLog("DELETE", "MedicalClaim", id, "Deleted medical claim");
  return true;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (date: string, n: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return iso(d);
};

/** First invoice date on/after `from` for a contract's cycle. */
export function firstRunDate(contract: Pick<ClientContract, "billingCycle" | "billingDay">, from: string): string {
  if (contract.billingCycle !== "Monthly") return from;
  const d = new Date(from);
  const day = Math.min(Math.max(contract.billingDay || 1, 1), 28);
  d.setDate(day);
  if (iso(d) < from) d.setMonth(d.getMonth() + 1);
  return iso(d);
}

function nextRunDate(contract: ClientContract, afterRun: string): string {
  if (contract.billingCycle === "Weekly") return addDays(afterRun, 7);
  if (contract.billingCycle === "Fortnightly") return addDays(afterRun, 14);
  const d = new Date(afterRun);
  d.setMonth(d.getMonth() + 1);
  return iso(d);
}

/** Billing period that a run on `runDate` covers (the cycle just finished). */
function periodFor(contract: ClientContract, runDate: string): { start: string; end: string } {
  const end = addDays(runDate, -1);
  if (contract.billingCycle === "Weekly") return { start: addDays(end, -6), end };
  if (contract.billingCycle === "Fortnightly") return { start: addDays(end, -13), end };
  const d = new Date(runDate);
  d.setMonth(d.getMonth() - 1);
  return { start: iso(d), end };
}

export function addContract(
  contract: Omit<ClientContract, "id" | "createdAt" | "updatedAt">,
): ClientContract {
  const s = getState();
  const now = new Date().toISOString();
  const row: ClientContract = { ...contract, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, contracts: [row, ...s.contracts] });
  void supabase.from("client_contracts").insert({ id: row.id, ...toContract(row) })
    .then(({ error }) => fail("client_contracts", error));
  addAuditLog("CREATE", "ClientContract", row.id, `Contract ${row.contractNo}`);
  return row;
}

export function updateContract(id: string, updates: Partial<ClientContract>): ClientContract | undefined {
  const s = getState();
  const existing = s.contracts.find((c) => c.id === id);
  if (!existing) return undefined;
  const updated: ClientContract = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, contracts: s.contracts.map((c) => (c.id === id ? updated : c)) });
  void supabase.from("client_contracts").update(toContract(updated)).eq("id", id)
    .then(({ error }) => fail("client_contracts", error));
  addAuditLog("UPDATE", "ClientContract", id, `Contract ${updated.contractNo} updated`);
  return updated;
}

export function deleteContract(id: string): boolean {
  const s = getState();
  if (!s.contracts.some((c) => c.id === id)) return false;
  setState({ ...s, contracts: s.contracts.filter((c) => c.id !== id) });
  void supabase.from("client_contracts").delete().eq("id", id)
    .then(({ error }) => fail("client_contracts", error));
  addAuditLog("DELETE", "ClientContract", id, "Deleted contract");
  return true;
}

/** Contracts whose next invoice date has arrived. */
export function contractsDue(onDate = iso(new Date())): ClientContract[] {
  return getState().contracts.filter(
    (c) =>
      c.status === "Active" &&
      c.autoInvoice &&
      !!c.nextInvoiceOn &&
      c.nextInvoiceOn <= onDate &&
      (!c.endDate || c.endDate >= c.nextInvoiceOn),
  );
}

export interface ContractRunResult {
  created: Invoice[];
  skipped: { contract: ClientContract; reason: string }[];
}

/** Generate invoices for every contract that is due, then roll their schedule forward. */
export function runContractBilling(onDate = iso(new Date())): ContractRunResult {
  const created: Invoice[] = [];
  const skipped: ContractRunResult["skipped"] = [];

  for (const contract of contractsDue(onDate)) {
    const runDate = contract.nextInvoiceOn!;
    const { start, end } = periodFor(contract, runDate);

    let lines: InvoiceLine[];
    if (contract.billingSource === "Fixed") {
      lines = [{
        id: newId(),
        invoiceId: "",
        description: `${contract.title || contract.contractNo} — ${contract.billingCycle.toLowerCase()} service charge`,
        unit: "Monthly",
        quantity: 1,
        rate: contract.fixedAmount,
        otQuantity: 0,
        otRate: 0,
        amount: contract.fixedAmount,
        createdAt: new Date().toISOString(),
      }];
    } else {
      lines = buildInvoiceLines(contract.clientId, start, end, contract.projectId);
    }

    if (lines.length === 0) {
      skipped.push({ contract, reason: `No billable data for ${start} → ${end}` });
      continue;
    }

    const invoice = addInvoice({
      companyId: contract.companyId ?? getCurrentCompany(),
      clientId: contract.clientId,
      projectId: contract.projectId,
      periodStart: start,
      periodEnd: end,
      issueDate: onDate,
      dueDate: addDays(onDate, contract.paymentTermsDays || 30),
      lines,
      gstRate: contract.gstRate,
      amountPaid: 0,
      status: "Draft",
      notes: `Auto-generated from contract ${contract.contractNo}`,
    });
    created.push(invoice);

    updateContract(contract.id, {
      lastInvoicedOn: runDate,
      nextInvoiceOn: nextRunDate(contract, runDate),
      status: contract.endDate && contract.endDate < nextRunDate(contract, runDate) ? "Expired" : contract.status,
    });
  }

  return { created, skipped };
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

/* ---------------- accommodation ---------------- */
export function getDormitories(): Dormitory[] { return getState().dormitories; }
export function getAllocations(): BedAllocation[] { return getState().allocations; }

export function addDormitory(x: Omit<Dormitory, "id" | "createdAt" | "updatedAt">): Dormitory {
  const s = getState();
  const now = new Date().toISOString();
  const row: Dormitory = { ...x, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, dormitories: [row, ...s.dormitories] });
  void supabase.from("dormitories").insert({ id: row.id, ...toDormitory(row) })
    .then(({ error }) => fail("dormitories", error));
  addAuditLog("CREATE", "Dormitory", row.id, `Added dormitory ${row.name}`);
  return row;
}

export function updateDormitory(id: string, updates: Partial<Dormitory>): Dormitory | undefined {
  const s = getState();
  const existing = s.dormitories.find((x) => x.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, dormitories: s.dormitories.map((x) => (x.id === id ? updated : x)) });
  void supabase.from("dormitories").update(toDormitory(updated)).eq("id", id)
    .then(({ error }) => fail("dormitories", error));
  addAuditLog("UPDATE", "Dormitory", id, `Updated dormitory ${updated.name}`);
  return updated;
}

export function deleteDormitory(id: string): boolean {
  const s = getState();
  if (!s.dormitories.some((x) => x.id === id)) return false;
  setState({
    ...s,
    dormitories: s.dormitories.filter((x) => x.id !== id),
    allocations: s.allocations.filter((a) => a.dormitoryId !== id),
  });
  void supabase.from("dormitories").delete().eq("id", id).then(({ error }) => fail("dormitories", error));
  addAuditLog("DELETE", "Dormitory", id, "Deleted dormitory");
  return true;
}

export function addAllocation(x: Omit<BedAllocation, "id" | "createdAt" | "updatedAt">): BedAllocation {
  const s = getState();
  const now = new Date().toISOString();
  const row: BedAllocation = { ...x, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, allocations: [row, ...s.allocations] });
  void supabase.from("bed_allocations").insert({ id: row.id, ...toAllocation(row) })
    .then(({ error }) => fail("bed_allocations", error));
  const dorm = s.dormitories.find((d) => d.id === row.dormitoryId);
  if (dorm) updateEmployee(row.employeeId, { dormitory: `${dorm.name} · ${row.roomNo}` });
  addAuditLog("CREATE", "BedAllocation", row.id, `Allocated room ${row.roomNo}`);
  return row;
}

export function updateAllocation(id: string, updates: Partial<BedAllocation>): BedAllocation | undefined {
  const s = getState();
  const existing = s.allocations.find((a) => a.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, allocations: s.allocations.map((a) => (a.id === id ? updated : a)) });
  void supabase.from("bed_allocations").update(toAllocation(updated)).eq("id", id)
    .then(({ error }) => fail("bed_allocations", error));
  addAuditLog("UPDATE", "BedAllocation", id, `Updated allocation ${updated.roomNo}`);
  return updated;
}

/** Move out: closes the allocation and clears the employee dormitory field. */
export function checkOutAllocation(id: string, date = new Date().toISOString().slice(0, 10)) {
  const alloc = getState().allocations.find((a) => a.id === id);
  if (!alloc) return undefined;
  updateEmployee(alloc.employeeId, { dormitory: "" });
  return updateAllocation(id, { status: "Vacated", checkOutDate: date });
}

export function deleteAllocation(id: string): boolean {
  const s = getState();
  if (!s.allocations.some((a) => a.id === id)) return false;
  setState({ ...s, allocations: s.allocations.filter((a) => a.id !== id) });
  void supabase.from("bed_allocations").delete().eq("id", id).then(({ error }) => fail("bed_allocations", error));
  addAuditLog("DELETE", "BedAllocation", id, "Deleted allocation");
  return true;
}

export function dormOccupancy(dormitoryId: string): number {
  return getState().allocations.filter((a) => a.dormitoryId === dormitoryId && a.status !== "Vacated").length;
}

/* ---------------- transport ---------------- */
export function getVehicles(): Vehicle[] { return getState().vehicles; }
export function getTrips(): Trip[] { return getState().trips; }

export function addVehicle(x: Omit<Vehicle, "id" | "createdAt" | "updatedAt">): Vehicle {
  const s = getState();
  const now = new Date().toISOString();
  const row: Vehicle = { ...x, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, vehicles: [row, ...s.vehicles] });
  void supabase.from("vehicles").insert({ id: row.id, ...toVehicle(row) })
    .then(({ error }) => fail("vehicles", error));
  addAuditLog("CREATE", "Vehicle", row.id, `Added vehicle ${row.plateNo}`);
  return row;
}

export function updateVehicle(id: string, updates: Partial<Vehicle>): Vehicle | undefined {
  const s = getState();
  const existing = s.vehicles.find((v) => v.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, vehicles: s.vehicles.map((v) => (v.id === id ? updated : v)) });
  void supabase.from("vehicles").update(toVehicle(updated)).eq("id", id)
    .then(({ error }) => fail("vehicles", error));
  addAuditLog("UPDATE", "Vehicle", id, `Updated vehicle ${updated.plateNo}`);
  return updated;
}

export function deleteVehicle(id: string): boolean {
  const s = getState();
  if (!s.vehicles.some((v) => v.id === id)) return false;
  setState({ ...s, vehicles: s.vehicles.filter((v) => v.id !== id), trips: s.trips.filter((t) => t.vehicleId !== id) });
  void supabase.from("vehicles").delete().eq("id", id).then(({ error }) => fail("vehicles", error));
  addAuditLog("DELETE", "Vehicle", id, "Deleted vehicle");
  return true;
}

export function addTrip(x: Omit<Trip, "id" | "createdAt" | "updatedAt">): Trip {
  const s = getState();
  const now = new Date().toISOString();
  const row: Trip = { ...x, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, trips: [row, ...s.trips] });
  void supabase.from("trips").insert({ id: row.id, ...toTrip(row) }).then(({ error }) => fail("trips", error));
  addAuditLog("CREATE", "Trip", row.id, `Scheduled trip on ${row.date}`);
  return row;
}

export function updateTrip(id: string, updates: Partial<Trip>): Trip | undefined {
  const s = getState();
  const existing = s.trips.find((t) => t.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, trips: s.trips.map((t) => (t.id === id ? updated : t)) });
  void supabase.from("trips").update(toTrip(updated)).eq("id", id).then(({ error }) => fail("trips", error));
  addAuditLog("UPDATE", "Trip", id, `Trip set to ${updated.status}`);
  return updated;
}

export function deleteTrip(id: string): boolean {
  const s = getState();
  if (!s.trips.some((t) => t.id === id)) return false;
  setState({ ...s, trips: s.trips.filter((t) => t.id !== id) });
  void supabase.from("trips").delete().eq("id", id).then(({ error }) => fail("trips", error));
  addAuditLog("DELETE", "Trip", id, "Deleted trip");
  return true;
}

/** Vehicle documents (road tax / insurance / inspection) expiring within `days`. */
/* ---------------- driver management ---------------- */
export function getDriverProfiles(): DriverProfile[] { return getState().driverProfiles; }
export function getDriverProfile(employeeId: string): DriverProfile | undefined {
  return getState().driverProfiles.find((p) => p.employeeId === employeeId);
}
export function getDriverIncidents(): DriverIncident[] { return getState().driverIncidents; }
export function getFuelLogs(): FuelLog[] { return getState().fuelLogs; }

export function upsertDriverProfile(x: Omit<DriverProfile, "id" | "createdAt" | "updatedAt">): DriverProfile {
  const s = getState();
  const now = new Date().toISOString();
  const existing = s.driverProfiles.find((p) => p.employeeId === x.employeeId);
  if (existing) {
    const updated: DriverProfile = { ...existing, ...x, updatedAt: now };
    setState({ ...s, driverProfiles: s.driverProfiles.map((p) => (p.id === existing.id ? updated : p)) });
    void supabase.from("driver_profiles").update(toDriverProfile(updated)).eq("id", existing.id)
      .then(({ error }) => fail("driver_profiles", error));
    addAuditLog("UPDATE", "DriverProfile", existing.id, "Updated driver profile");
    return updated;
  }
  const row: DriverProfile = { ...x, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, driverProfiles: [row, ...s.driverProfiles] });
  void supabase.from("driver_profiles").insert({ id: row.id, ...toDriverProfile(row) })
    .then(({ error }) => fail("driver_profiles", error));
  addAuditLog("CREATE", "DriverProfile", row.id, "Created driver profile");
  return row;
}

export function deleteDriverProfile(id: string): boolean {
  const s = getState();
  if (!s.driverProfiles.some((p) => p.id === id)) return false;
  setState({ ...s, driverProfiles: s.driverProfiles.filter((p) => p.id !== id) });
  void supabase.from("driver_profiles").delete().eq("id", id).then(({ error }) => fail("driver_profiles", error));
  addAuditLog("DELETE", "DriverProfile", id, "Deleted driver profile");
  return true;
}

export function addDriverIncident(x: Omit<DriverIncident, "id" | "createdAt" | "updatedAt">): DriverIncident {
  const s = getState();
  const now = new Date().toISOString();
  const row: DriverIncident = { ...x, id: newId(), createdAt: now, updatedAt: now };
  const profiles = s.driverProfiles.map((p) =>
    p.employeeId === row.employeeId
      ? { ...p, demeritPoints: p.demeritPoints + row.demeritPoints, updatedAt: now }
      : p,
  );
  setState({ ...s, driverIncidents: [row, ...s.driverIncidents], driverProfiles: profiles });
  void supabase.from("driver_incidents").insert({ id: row.id, ...toDriverIncident(row) })
    .then(({ error }) => fail("driver_incidents", error));
  const prof = profiles.find((p) => p.employeeId === row.employeeId);
  if (prof && row.demeritPoints) {
    void supabase.from("driver_profiles").update({ demerit_points: prof.demeritPoints }).eq("id", prof.id)
      .then(({ error }) => fail("driver_profiles", error));
  }
  addAuditLog("CREATE", "DriverIncident", row.id, `Logged ${row.incidentType}`);
  return row;
}

export function updateDriverIncident(id: string, updates: Partial<DriverIncident>): DriverIncident | undefined {
  const s = getState();
  const existing = s.driverIncidents.find((i) => i.id === id);
  if (!existing) return undefined;
  const updated: DriverIncident = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, driverIncidents: s.driverIncidents.map((i) => (i.id === id ? updated : i)) });
  void supabase.from("driver_incidents").update(toDriverIncident(updated)).eq("id", id)
    .then(({ error }) => fail("driver_incidents", error));
  addAuditLog("UPDATE", "DriverIncident", id, `Incident set to ${updated.status}`);
  return updated;
}

export function deleteDriverIncident(id: string): boolean {
  const s = getState();
  if (!s.driverIncidents.some((i) => i.id === id)) return false;
  setState({ ...s, driverIncidents: s.driverIncidents.filter((i) => i.id !== id) });
  void supabase.from("driver_incidents").delete().eq("id", id).then(({ error }) => fail("driver_incidents", error));
  addAuditLog("DELETE", "DriverIncident", id, "Deleted incident");
  return true;
}

export function addFuelLog(x: Omit<FuelLog, "id" | "createdAt" | "updatedAt">): FuelLog {
  const s = getState();
  const now = new Date().toISOString();
  const row: FuelLog = { ...x, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, fuelLogs: [row, ...s.fuelLogs] });
  void supabase.from("driver_fuel_logs").insert({ id: row.id, ...toFuelLog(row) })
    .then(({ error }) => fail("driver_fuel_logs", error));
  addAuditLog("CREATE", "FuelLog", row.id, `Fuel log ${row.date}`);
  return row;
}

export function deleteFuelLog(id: string): boolean {
  const s = getState();
  if (!s.fuelLogs.some((f) => f.id === id)) return false;
  setState({ ...s, fuelLogs: s.fuelLogs.filter((f) => f.id !== id) });
  void supabase.from("driver_fuel_logs").delete().eq("id", id).then(({ error }) => fail("driver_fuel_logs", error));
  addAuditLog("DELETE", "FuelLog", id, "Deleted fuel log");
  return true;
}

/** Driving / vocational licence expiries within `days`. */
export function driverLicenceAlerts(days = 60) {
  const today = new Date().toISOString().slice(0, 10);
  const limit = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const out: { profile: DriverProfile; label: string; date: string; expired: boolean }[] = [];
  for (const p of getState().driverProfiles) {
    const checks: [string, string | undefined][] = [
      ["Driving licence", p.licenceExpiry],
      ["Vocational licence", p.vocationalLicenceExpiry],
      ["Medical checkup", p.medicalCheckupDue],
    ];
    for (const [label, date] of checks) {
      if (date && date <= limit) out.push({ profile: p, label, date, expired: date < today });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function vehicleExpiryAlerts(days = 60) {
  const today = new Date().toISOString().slice(0, 10);
  const limit = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const out: { vehicle: Vehicle; label: string; date: string; expired: boolean }[] = [];
  for (const v of getState().vehicles) {
    const checks: [string, string | undefined][] = [
      ["Road tax", v.roadTaxExpiry], ["Insurance", v.insuranceExpiry], ["Inspection", v.inspectionDue],
    ];
    for (const [label, date] of checks) {
      if (date && date <= limit) out.push({ vehicle: v, label, date, expired: date < today });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/* ---------------- assets & PPE ---------------- */
export function getAssets(): Asset[] { return getState().assets; }
export function getIssuances(): AssetIssuance[] { return getState().issuances; }

export function addAsset(x: Omit<Asset, "id" | "createdAt" | "updatedAt">): Asset {
  const s = getState();
  const now = new Date().toISOString();
  const row: Asset = { ...x, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, assets: [row, ...s.assets] });
  void supabase.from("assets").insert({ id: row.id, ...toAsset(row) })
    .then(({ error }) => fail("assets", error));
  addAuditLog("CREATE", "Asset", row.id, `Added asset ${row.name}`);
  return row;
}

export function updateAsset(id: string, updates: Partial<Asset>): Asset | undefined {
  const s = getState();
  const existing = s.assets.find((a) => a.id === id);
  if (!existing) return undefined;
  const updated: Asset = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, assets: s.assets.map((a) => (a.id === id ? updated : a)) });
  void supabase.from("assets").update(toAsset(updated)).eq("id", id)
    .then(({ error }) => fail("assets", error));
  addAuditLog("UPDATE", "Asset", id, `Updated asset ${updated.name}`);
  return updated;
}

export function deleteAsset(id: string): boolean {
  const s = getState();
  if (!s.assets.some((a) => a.id === id)) return false;
  setState({
    ...s,
    assets: s.assets.filter((a) => a.id !== id),
    issuances: s.issuances.filter((i) => i.assetId !== id),
  });
  void supabase.from("assets").delete().eq("id", id).then(({ error }) => fail("assets", error));
  addAuditLog("DELETE", "Asset", id, "Deleted asset");
  return true;
}

/** Quantity currently out on active issuances. */
export function assetIssuedQty(assetId: string): number {
  return getState().issuances
    .filter((i) => i.assetId === assetId && i.status === "Issued")
    .reduce((sum, i) => sum + i.quantity, 0);
}

export function assetAvailableQty(assetId: string): number {
  const asset = getState().assets.find((a) => a.id === assetId);
  if (!asset) return 0;
  return Math.max(0, asset.quantity - assetIssuedQty(assetId));
}

export function issueAsset(x: Omit<AssetIssuance, "id" | "createdAt" | "updatedAt">): AssetIssuance {
  const s = getState();
  const now = new Date().toISOString();
  const row: AssetIssuance = { ...x, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, issuances: [row, ...s.issuances] });
  void supabase.from("asset_issuances").insert({ id: row.id, ...toIssuance(row) })
    .then(({ error }) => fail("asset_issuances", error));
  const asset = s.assets.find((a) => a.id === row.assetId);
  if (asset && asset.status === "Available" && assetAvailableQty(asset.id) <= 0) {
    updateAsset(asset.id, { status: "Issued" });
  }
  addAuditLog("CREATE", "AssetIssuance", row.id, `Issued ${row.quantity} x ${asset?.name ?? "asset"}`);
  return row;
}

export function updateIssuance(id: string, updates: Partial<AssetIssuance>): AssetIssuance | undefined {
  const s = getState();
  const existing = s.issuances.find((i) => i.id === id);
  if (!existing) return undefined;
  const updated: AssetIssuance = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, issuances: s.issuances.map((i) => (i.id === id ? updated : i)) });
  void supabase.from("asset_issuances").update(toIssuance(updated)).eq("id", id)
    .then(({ error }) => fail("asset_issuances", error));
  addAuditLog("UPDATE", "AssetIssuance", id, "Updated issuance");
  return updated;
}

/** Return an issued item; optionally record condition or mark lost / damaged. */
export function returnIssuance(
  id: string,
  condition: AssetIssuance["conditionIn"] = "Good",
  status: AssetIssuance["status"] = "Returned",
  date = new Date().toISOString().slice(0, 10),
) {
  const result = updateIssuance(id, { status, conditionIn: condition, returnDate: date });
  const issuance = getState().issuances.find((i) => i.id === id);
  if (issuance) {
    const asset = getState().assets.find((a) => a.id === issuance.assetId);
    if (asset && asset.status === "Issued" && assetAvailableQty(asset.id) > 0) {
      updateAsset(asset.id, { status: "Available" });
    }
  }
  return result;
}

export function deleteIssuance(id: string): boolean {
  const s = getState();
  if (!s.issuances.some((i) => i.id === id)) return false;
  setState({ ...s, issuances: s.issuances.filter((i) => i.id !== id) });
  void supabase.from("asset_issuances").delete().eq("id", id).then(({ error }) => fail("asset_issuances", error));
  addAuditLog("DELETE", "AssetIssuance", id, "Deleted issuance");
  return true;
}

/** Assets whose warranty or calibration falls due within `days`. */
export function assetAlerts(days = 45) {
  const today = new Date().toISOString().slice(0, 10);
  const limit = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const out: { asset: Asset; label: string; date: string; expired: boolean }[] = [];
  for (const a of getState().assets) {
    const checks: [string, string | undefined][] = [
      ["Warranty", a.warrantyExpiry], ["Calibration", a.calibrationDue],
    ];
    for (const [label, date] of checks) {
      if (date && date <= limit) out.push({ asset: a, label, date, expired: date < today });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Issued items past their due date and still not returned. */
export function overdueIssuances() {
  const today = new Date().toISOString().slice(0, 10);
  return getState().issuances.filter((i) => i.status === "Issued" && i.dueDate && i.dueDate < today);
}

/* ---------------- training & safety ---------------- */
export function getCourses(): TrainingCourse[] { return getState().courses; }
export function getTrainings(): TrainingRecord[] { return getState().trainings; }
export function getIncidents(): SafetyIncident[] { return getState().incidents; }

export function addCourse(x: Omit<TrainingCourse, "id" | "createdAt" | "updatedAt">): TrainingCourse {
  const s = getState();
  const now = new Date().toISOString();
  const row: TrainingCourse = { ...x, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, courses: [row, ...s.courses] });
  void supabase.from("training_courses").insert({ id: row.id, ...toCourse(row) })
    .then(({ error }) => fail("training_courses", error));
  addAuditLog("CREATE", "TrainingCourse", row.id, `Added course ${row.name}`);
  return row;
}

export function updateCourse(id: string, updates: Partial<TrainingCourse>): TrainingCourse | undefined {
  const s = getState();
  const existing = s.courses.find((c) => c.id === id);
  if (!existing) return undefined;
  const updated: TrainingCourse = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, courses: s.courses.map((c) => (c.id === id ? updated : c)) });
  void supabase.from("training_courses").update(toCourse(updated)).eq("id", id)
    .then(({ error }) => fail("training_courses", error));
  addAuditLog("UPDATE", "TrainingCourse", id, `Updated course ${updated.name}`);
  return updated;
}

export function deleteCourse(id: string): boolean {
  const s = getState();
  if (!s.courses.some((c) => c.id === id)) return false;
  setState({
    ...s,
    courses: s.courses.filter((c) => c.id !== id),
    trainings: s.trainings.filter((t) => t.courseId !== id),
  });
  void supabase.from("training_courses").delete().eq("id", id)
    .then(({ error }) => fail("training_courses", error));
  addAuditLog("DELETE", "TrainingCourse", id, "Deleted course");
  return true;
}

/** Add a training record; expiry auto-derived from course validity when absent. */
export function addTraining(x: Omit<TrainingRecord, "id" | "createdAt" | "updatedAt">): TrainingRecord {
  const s = getState();
  const now = new Date().toISOString();
  let expiryDate = x.expiryDate;
  if (!expiryDate && x.completionDate) {
    const course = s.courses.find((c) => c.id === x.courseId);
    if (course?.validityMonths) {
      const dt = new Date(x.completionDate);
      dt.setMonth(dt.getMonth() + course.validityMonths);
      expiryDate = dt.toISOString().slice(0, 10);
    }
  }
  const row: TrainingRecord = { ...x, expiryDate, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, trainings: [row, ...s.trainings] });
  void supabase.from("training_records").insert({ id: row.id, ...toTraining(row) })
    .then(({ error }) => fail("training_records", error));
  addAuditLog("CREATE", "TrainingRecord", row.id, "Added training record");
  return row;
}

export function updateTraining(id: string, updates: Partial<TrainingRecord>): TrainingRecord | undefined {
  const s = getState();
  const existing = s.trainings.find((t) => t.id === id);
  if (!existing) return undefined;
  const updated: TrainingRecord = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, trainings: s.trainings.map((t) => (t.id === id ? updated : t)) });
  void supabase.from("training_records").update(toTraining(updated)).eq("id", id)
    .then(({ error }) => fail("training_records", error));
  addAuditLog("UPDATE", "TrainingRecord", id, "Updated training record");
  return updated;
}

export function deleteTraining(id: string): boolean {
  const s = getState();
  if (!s.trainings.some((t) => t.id === id)) return false;
  setState({ ...s, trainings: s.trainings.filter((t) => t.id !== id) });
  void supabase.from("training_records").delete().eq("id", id)
    .then(({ error }) => fail("training_records", error));
  addAuditLog("DELETE", "TrainingRecord", id, "Deleted training record");
  return true;
}

export function addIncident(x: Omit<SafetyIncident, "id" | "createdAt" | "updatedAt">): SafetyIncident {
  const s = getState();
  const now = new Date().toISOString();
  const row: SafetyIncident = { ...x, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, incidents: [row, ...s.incidents] });
  void supabase.from("safety_incidents").insert({ id: row.id, ...toIncident(row) })
    .then(({ error }) => fail("safety_incidents", error));
  addAuditLog("CREATE", "SafetyIncident", row.id, `Reported ${row.incidentType}`);
  return row;
}

export function updateIncident(id: string, updates: Partial<SafetyIncident>): SafetyIncident | undefined {
  const s = getState();
  const existing = s.incidents.find((i) => i.id === id);
  if (!existing) return undefined;
  const updated: SafetyIncident = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, incidents: s.incidents.map((i) => (i.id === id ? updated : i)) });
  void supabase.from("safety_incidents").update(toIncident(updated)).eq("id", id)
    .then(({ error }) => fail("safety_incidents", error));
  addAuditLog("UPDATE", "SafetyIncident", id, "Updated incident");
  return updated;
}

export function deleteIncident(id: string): boolean {
  const s = getState();
  if (!s.incidents.some((i) => i.id === id)) return false;
  setState({ ...s, incidents: s.incidents.filter((i) => i.id !== id) });
  void supabase.from("safety_incidents").delete().eq("id", id)
    .then(({ error }) => fail("safety_incidents", error));
  addAuditLog("DELETE", "SafetyIncident", id, "Deleted incident");
  return true;
}

/** Certifications expiring within `days` (or already expired). */
export function certificationAlerts(days = 60) {
  const today = new Date().toISOString().slice(0, 10);
  const limit = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  return getState().trainings
    .filter((t) => t.expiryDate && t.expiryDate <= limit && t.status !== "Failed")
    .map((t) => ({ training: t, date: t.expiryDate!, expired: t.expiryDate! < today }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Employees missing a valid record for each mandatory course. */
export function mandatoryTrainingGaps(companyId?: string) {
  const s = getState();
  const today = new Date().toISOString().slice(0, 10);
  const mandatory = s.courses.filter((c) => c.mandatory && (!companyId || !c.companyId || c.companyId === companyId));
  const employees = s.employees.filter((e) => e.status === "Active" && (!companyId || e.companyId === companyId));
  const gaps: { employeeId: string; courseId: string }[] = [];
  for (const c of mandatory) {
    for (const e of employees) {
      const ok = s.trainings.some(
        (t) => t.courseId === c.id && t.employeeId === e.id && t.status === "Completed" &&
          (!t.expiryDate || t.expiryDate >= today),
      );
      if (!ok) gaps.push({ employeeId: e.id, courseId: c.id });
    }
  }
  return gaps;
}

/* ---------------- Phase 10: recruitment ---------------- */
export function getRequisitions(): JobRequisition[] { return getState().requisitions; }
export function getCandidates(): Candidate[] { return getState().candidates; }

export function addRequisition(x: Omit<JobRequisition, "id" | "createdAt" | "updatedAt">): JobRequisition {
  const s = getState();
  const now = new Date().toISOString();
  const row: JobRequisition = { ...x, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, requisitions: [row, ...s.requisitions] });
  void supabase.from("job_requisitions").insert({ id: row.id, ...toRequisition(row) })
    .then(({ error }) => fail("job_requisitions", error));
  addAuditLog("CREATE", "JobRequisition", row.id, `Created requisition ${row.title}`);
  return row;
}

export function updateRequisition(id: string, updates: Partial<JobRequisition>): JobRequisition | undefined {
  const s = getState();
  const existing = s.requisitions.find((r) => r.id === id);
  if (!existing) return undefined;
  const updated: JobRequisition = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, requisitions: s.requisitions.map((r) => (r.id === id ? updated : r)) });
  void supabase.from("job_requisitions").update(toRequisition(updated)).eq("id", id)
    .then(({ error }) => fail("job_requisitions", error));
  addAuditLog("UPDATE", "JobRequisition", id, "Updated requisition");
  return updated;
}

export function deleteRequisition(id: string): boolean {
  const s = getState();
  if (!s.requisitions.some((r) => r.id === id)) return false;
  setState({ ...s, requisitions: s.requisitions.filter((r) => r.id !== id) });
  void supabase.from("job_requisitions").delete().eq("id", id)
    .then(({ error }) => fail("job_requisitions", error));
  addAuditLog("DELETE", "JobRequisition", id, "Deleted requisition");
  return true;
}

export function addCandidate(x: Omit<Candidate, "id" | "createdAt" | "updatedAt">): Candidate {
  const s = getState();
  const now = new Date().toISOString();
  const row: Candidate = { ...x, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, candidates: [row, ...s.candidates] });
  void supabase.from("candidates").insert({ id: row.id, ...toCandidate(row) })
    .then(({ error }) => fail("candidates", error));
  addAuditLog("CREATE", "Candidate", row.id, `Added candidate ${row.name}`);
  return row;
}

export function updateCandidate(id: string, updates: Partial<Candidate>): Candidate | undefined {
  const s = getState();
  const existing = s.candidates.find((c) => c.id === id);
  if (!existing) return undefined;
  const updated: Candidate = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, candidates: s.candidates.map((c) => (c.id === id ? updated : c)) });
  void supabase.from("candidates").update(toCandidate(updated)).eq("id", id)
    .then(({ error }) => fail("candidates", error));
  addAuditLog("UPDATE", "Candidate", id, `Updated candidate ${updated.name}`);
  return updated;
}

export function deleteCandidate(id: string): boolean {
  const s = getState();
  if (!s.candidates.some((c) => c.id === id)) return false;
  setState({ ...s, candidates: s.candidates.filter((c) => c.id !== id) });
  void supabase.from("candidates").delete().eq("id", id)
    .then(({ error }) => fail("candidates", error));
  addAuditLog("DELETE", "Candidate", id, "Deleted candidate");
  return true;
}

/** Move a candidate to the next stage of the hiring pipeline. */
export const candidateStages: Candidate["stage"][] = [
  "Applied", "Screening", "Interview", "Selected", "Offer Sent",
  "Offer Accepted", "Onboarding", "Hired",
];

export function advanceCandidate(id: string): Candidate | undefined {
  const c = getState().candidates.find((x) => x.id === id);
  if (!c) return undefined;
  const idx = candidateStages.indexOf(c.stage);
  if (idx < 0 || idx >= candidateStages.length - 1) return c;
  return updateCandidate(id, { stage: candidateStages[idx + 1] });
}

/** Convert a candidate into an employee record (onboarding hand-off). */
export function convertCandidateToEmployee(id: string): Employee | undefined {
  const s = getState();
  const c = s.candidates.find((x) => x.id === id);
  if (!c || c.employeeId) return undefined;
  const req = c.requisitionId ? s.requisitions.find((r) => r.id === c.requisitionId) : undefined;
  const emp = addEmployee({
    name: c.name,
    nationality: c.nationality ?? "",
    fin: "",
    passType: req?.passType ?? "Work Permit",
    passExpiry: "-",
    trade: c.trade ?? req?.trade ?? "",
    site: null,
    status: "Draft",
    basicSalary: c.expectedSalary ?? req?.budgetSalary ?? 0,
    joinedOn: c.joinDate ?? new Date().toISOString().slice(0, 10),
    phone: c.phone,
    email: c.email,
    passportNumber: c.passportNumber,
    companyId: c.companyId || s.currentCompany || undefined,
    applicationDate: c.createdAt.slice(0, 10),
    remarks: `Hired via recruitment (source: ${c.source}${c.agentName ? ` / ${c.agentName}` : ""})`,
  });
  updateCandidate(id, { stage: "Hired", employeeId: emp.id });
  return emp;
}

/** Hiring funnel counts for the recruitment dashboard. */
export function recruitmentFunnel(companyId?: string) {
  const list = getState().candidates.filter((c) => !companyId || !c.companyId || c.companyId === companyId);
  return candidateStages.map((stage) => ({ stage, count: list.filter((c) => c.stage === stage).length }));
}

/* ---------------- Phase 11: client CRM ---------------- */
export function getLeads(): Lead[] { return getState().leads; }
export function getActivities(): CrmActivity[] { return getState().activities; }

export const leadStages: Lead["stage"][] = [
  "New", "Contacted", "Qualified", "Quotation Sent", "Negotiation", "Won", "Lost",
];

const defaultProbability: Record<Lead["stage"], number> = {
  New: 10, Contacted: 20, Qualified: 40, "Quotation Sent": 60,
  Negotiation: 75, Won: 100, Lost: 0,
};

export function addLead(x: Omit<Lead, "id" | "createdAt" | "updatedAt">): Lead {
  const s = getState();
  const now = new Date().toISOString();
  const row: Lead = { ...x, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, leads: [row, ...s.leads] });
  void supabase.from("leads").insert({ id: row.id, ...toLead(row) }).then(({ error }) => fail("leads", error));
  addAuditLog("CREATE", "Lead", row.id, `Created lead ${row.companyName}`);
  return row;
}

export function updateLead(id: string, updates: Partial<Lead>): Lead | undefined {
  const s = getState();
  const existing = s.leads.find((l) => l.id === id);
  if (!existing) return undefined;
  const updated: Lead = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, leads: s.leads.map((l) => (l.id === id ? updated : l)) });
  void supabase.from("leads").update(toLead(updated)).eq("id", id).then(({ error }) => fail("leads", error));
  addAuditLog("UPDATE", "Lead", id, `Updated lead ${updated.companyName}`);
  return updated;
}

export function deleteLead(id: string): boolean {
  const s = getState();
  if (!s.leads.some((l) => l.id === id)) return false;
  setState({ ...s, leads: s.leads.filter((l) => l.id !== id) });
  void supabase.from("leads").delete().eq("id", id).then(({ error }) => fail("leads", error));
  addAuditLog("DELETE", "Lead", id, "Deleted lead");
  return true;
}

/** Move a lead to a stage and auto-set its win probability. */
export function setLeadStage(id: string, stage: Lead["stage"], lostReason?: string): Lead | undefined {
  return updateLead(id, { stage, probability: defaultProbability[stage], lostReason });
}

/** Convert a won lead into a client record. */
export function convertLeadToClient(id: string): Client | undefined {
  const s = getState();
  const lead = s.leads.find((l) => l.id === id);
  if (!lead || lead.clientId) return undefined;
  const client = addClient({
    name: lead.companyName,
    contactPerson: lead.contactPerson ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    address: "",
    status: "Active",
    industry: lead.industry,
  });
  updateLead(id, { clientId: client.id, stage: "Won", probability: 100 });
  return client;
}

export function addActivity(x: Omit<CrmActivity, "id" | "createdAt" | "updatedAt">): CrmActivity {
  const s = getState();
  const now = new Date().toISOString();
  const row: CrmActivity = { ...x, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, activities: [row, ...s.activities] });
  void supabase.from("crm_activities").insert({ id: row.id, ...toActivity(row) })
    .then(({ error }) => fail("crm_activities", error));
  addAuditLog("CREATE", "CrmActivity", row.id, `Logged ${row.activityType}: ${row.subject}`);
  return row;
}

export function updateActivity(id: string, updates: Partial<CrmActivity>): CrmActivity | undefined {
  const s = getState();
  const existing = s.activities.find((a) => a.id === id);
  if (!existing) return undefined;
  const updated: CrmActivity = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, activities: s.activities.map((a) => (a.id === id ? updated : a)) });
  void supabase.from("crm_activities").update(toActivity(updated)).eq("id", id)
    .then(({ error }) => fail("crm_activities", error));
  return updated;
}

export function deleteActivity(id: string): boolean {
  const s = getState();
  if (!s.activities.some((a) => a.id === id)) return false;
  setState({ ...s, activities: s.activities.filter((a) => a.id !== id) });
  void supabase.from("crm_activities").delete().eq("id", id)
    .then(({ error }) => fail("crm_activities", error));
  return true;
}

/** Pipeline value grouped by stage (weighted by probability). */
export function crmPipeline(companyId?: string) {
  const list = getState().leads.filter((l) => !companyId || !l.companyId || l.companyId === companyId);
  return leadStages.map((stage) => {
    const rows = list.filter((l) => l.stage === stage);
    return {
      stage,
      count: rows.length,
      value: rows.reduce((sum, l) => sum + (l.monthlyValue || 0), 0),
      weighted: rows.reduce((sum, l) => sum + (l.monthlyValue || 0) * (l.probability || 0) / 100, 0),
    };
  });
}

/** Follow-ups that are due today or overdue. */
export function dueFollowUps(companyId?: string): CrmActivity[] {
  const today = new Date().toISOString().slice(0, 10);
  return getState().activities.filter(
    (a) => !a.done && a.followUpDate && a.followUpDate <= today &&
      (!companyId || !a.companyId || a.companyId === companyId),
  );
}

/* ---------------- Phase 12: finance ---------------- */
export function getExpenses(): Expense[] { return getState().expenses; }
export function getReceipts(): PaymentReceipt[] { return getState().receipts; }

export const expenseCategories: Expense["category"][] = [
  "Levy", "Salary", "Dormitory", "Transport", "Insurance", "Medical",
  "PPE & Assets", "Training", "Agent Fee", "Office", "Government Fee", "Other",
];
export const paymentModes: PaymentReceipt["paymentMode"][] = [
  "Bank Transfer", "GIRO", "Cheque", "Cash", "PayNow", "Other",
];

export function addExpense(x: Omit<Expense, "id" | "createdAt" | "updatedAt">): Expense {
  const s = getState();
  const now = new Date().toISOString();
  const row: Expense = { ...x, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, expenses: [row, ...s.expenses] });
  void supabase.from("expenses").insert({ id: row.id, ...toExpense(row) })
    .then(({ error }) => fail("expenses", error));
  addAuditLog("CREATE", "Expense", row.id, `Recorded ${row.category} expense $${row.amount}`);
  return row;
}

export function updateExpense(id: string, updates: Partial<Expense>): Expense | undefined {
  const s = getState();
  const existing = s.expenses.find((e) => e.id === id);
  if (!existing) return undefined;
  const updated: Expense = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, expenses: s.expenses.map((e) => (e.id === id ? updated : e)) });
  void supabase.from("expenses").update(toExpense(updated)).eq("id", id)
    .then(({ error }) => fail("expenses", error));
  addAuditLog("UPDATE", "Expense", id, `Updated expense ${updated.description}`);
  return updated;
}

export function deleteExpense(id: string): boolean {
  const s = getState();
  if (!s.expenses.some((e) => e.id === id)) return false;
  setState({ ...s, expenses: s.expenses.filter((e) => e.id !== id) });
  void supabase.from("expenses").delete().eq("id", id).then(({ error }) => fail("expenses", error));
  addAuditLog("DELETE", "Expense", id, "Deleted expense");
  return true;
}

export function markExpensePaid(id: string, paidOn?: string): Expense | undefined {
  return updateExpense(id, { status: "Paid", paidOn: paidOn ?? new Date().toISOString().slice(0, 10) });
}

/** Record a client payment; keeps the linked invoice's amountPaid/status in sync. */
export function addReceipt(x: Omit<PaymentReceipt, "id" | "receiptNo" | "createdAt" | "updatedAt"> & { receiptNo?: string }): PaymentReceipt {
  const s = getState();
  const now = new Date().toISOString();
  const receiptNo = x.receiptNo?.trim() || `RCP-${String(s.receipts.length + 1).padStart(4, "0")}`;
  const row: PaymentReceipt = { ...x, receiptNo, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, receipts: [row, ...s.receipts] });
  void supabase.from("payment_receipts").insert({ id: row.id, ...toPaymentReceipt(row) })
    .then(({ error }) => fail("payment_receipts", error));
  addAuditLog("CREATE", "PaymentReceipt", row.id, `Received $${row.amount} (${receiptNo})`);

  if (row.invoiceId) {
    const inv = getState().invoices.find((i) => i.id === row.invoiceId);
    if (inv) {
      const paid = (inv.amountPaid || 0) + row.amount;
      updateInvoice(inv.id, {
        amountPaid: paid,
        status: paid >= inv.total ? "Paid" : "Partially Paid",
      });
    }
  }
  return row;
}

export function deleteReceipt(id: string): boolean {
  const s = getState();
  const row = s.receipts.find((r) => r.id === id);
  if (!row) return false;
  setState({ ...s, receipts: s.receipts.filter((r) => r.id !== id) });
  void supabase.from("payment_receipts").delete().eq("id", id)
    .then(({ error }) => fail("payment_receipts", error));
  if (row.invoiceId) {
    const inv = getState().invoices.find((i) => i.id === row.invoiceId);
    if (inv) {
      const paid = Math.max(0, (inv.amountPaid || 0) - row.amount);
      updateInvoice(inv.id, { amountPaid: paid, status: paid <= 0 ? "Sent" : "Partially Paid" });
    }
  }
  addAuditLog("DELETE", "PaymentReceipt", id, "Deleted receipt");
  return true;
}

const inMonth = (date: string | undefined, month: string) => !!date && date.slice(0, 7) === month;

/** Revenue / expense / profit summary for a YYYY-MM month (company scoped). */
export function financeSummary(month: string, companyId?: string) {
  const s = getState();
  const scope = <T extends { companyId?: string }>(rows: T[]) =>
    rows.filter((r) => !companyId || !r.companyId || r.companyId === companyId);

  const invoices = scope(s.invoices).filter((i) => inMonth(i.issueDate, month) && i.status !== "Cancelled");
  const expenses = scope(s.expenses).filter((e) => inMonth(e.expenseDate, month) && e.status !== "Rejected");
  const receipts = scope(s.receipts).filter((r) => inMonth(r.receivedOn, month));

  const revenue = invoices.reduce((sum, i) => sum + (i.subtotal || 0), 0);
  const cost = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const collected = receipts.reduce((sum, r) => sum + (r.amount || 0), 0);
  const outstanding = scope(s.invoices)
    .filter((i) => i.status !== "Paid" && i.status !== "Cancelled")
    .reduce((sum, i) => sum + Math.max(0, (i.total || 0) - (i.amountPaid || 0)), 0);
  const unpaidExpenses = scope(s.expenses)
    .filter((e) => e.status === "Pending" || e.status === "Approved")
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const byCategory = expenseCategories
    .map((category) => ({
      category,
      amount: expenses.filter((e) => e.category === category).reduce((sum, e) => sum + (e.amount || 0), 0),
    }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const profit = revenue - cost;
  return {
    revenue, cost, profit, collected, outstanding, unpaidExpenses, byCategory,
    margin: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
    invoiceCount: invoices.length,
    expenseCount: expenses.length,
  };
}

/** Last N months of revenue vs cost, oldest first. */
export function financeTrend(months = 6, companyId?: string) {
  const now = new Date();
  const out: { month: string; revenue: number; cost: number; profit: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d2 = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, "0")}`;
    const sum = financeSummary(key, companyId);
    out.push({ month: key, revenue: sum.revenue, cost: sum.cost, profit: sum.profit });
  }
  return out;
}

/* ---------------- Phase 13: inventory & procurement ---------------- */
export function getInventory(): InventoryItem[] { return getState().inventory; }
export function getMovements(): StockMovement[] { return getState().movements; }
export function getPurchaseOrders(): PurchaseOrder[] { return getState().purchaseOrders; }

export function addInventoryItem(x: Omit<InventoryItem, "id" | "createdAt" | "updatedAt">): InventoryItem {
  const s = getState();
  const now = new Date().toISOString();
  const row: InventoryItem = { ...x, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, inventory: [row, ...s.inventory] });
  void supabase.from("inventory_items").insert({ id: row.id, ...toItem(row) })
    .then(({ error }) => fail("inventory_items", error));
  addAuditLog("CREATE", "InventoryItem", row.id, `Added item ${row.name}`);
  return row;
}

export function updateInventoryItem(id: string, updates: Partial<InventoryItem>): InventoryItem | undefined {
  const s = getState();
  const existing = s.inventory.find((i) => i.id === id);
  if (!existing) return undefined;
  const updated: InventoryItem = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, inventory: s.inventory.map((i) => (i.id === id ? updated : i)) });
  void supabase.from("inventory_items").update(toItem(updated)).eq("id", id)
    .then(({ error }) => fail("inventory_items", error));
  addAuditLog("UPDATE", "InventoryItem", id, `Updated item ${updated.name}`);
  return updated;
}

export function deleteInventoryItem(id: string): boolean {
  const s = getState();
  if (!s.inventory.some((i) => i.id === id)) return false;
  setState({
    ...s,
    inventory: s.inventory.filter((i) => i.id !== id),
    movements: s.movements.filter((m) => m.itemId !== id),
  });
  void supabase.from("inventory_items").delete().eq("id", id)
    .then(({ error }) => fail("inventory_items", error));
  addAuditLog("DELETE", "InventoryItem", id, "Deleted inventory item");
  return true;
}

export function addStockMovement(x: Omit<StockMovement, "id" | "createdAt" | "updatedAt">): StockMovement {
  const s = getState();
  const now = new Date().toISOString();
  const row: StockMovement = { ...x, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, movements: [row, ...s.movements] });
  void supabase.from("stock_movements").insert({ id: row.id, ...toMovement(row) })
    .then(({ error }) => fail("stock_movements", error));
  const item = s.inventory.find((i) => i.id === row.itemId);
  addAuditLog("CREATE", "StockMovement", row.id, `${row.movementType} ${row.quantity} x ${item?.name ?? "item"}`);
  return row;
}

export function deleteStockMovement(id: string): boolean {
  const s = getState();
  if (!s.movements.some((m) => m.id === id)) return false;
  setState({ ...s, movements: s.movements.filter((m) => m.id !== id) });
  void supabase.from("stock_movements").delete().eq("id", id)
    .then(({ error }) => fail("stock_movements", error));
  addAuditLog("DELETE", "StockMovement", id, "Deleted stock movement");
  return true;
}

/** Current stock on hand = opening qty + inbound - outbound. */
export function stockOnHand(itemId: string): number {
  const s = getState();
  const item = s.inventory.find((i) => i.id === itemId);
  const opening = item?.openingQty ?? 0;
  return s.movements.filter((m) => m.itemId === itemId).reduce((qty, m) => {
    if (m.movementType === "In" || m.movementType === "Return") return qty + m.quantity;
    if (m.movementType === "Out" || m.movementType === "Damaged") return qty - m.quantity;
    return qty + m.quantity; // Adjustment can be +/-
  }, opening);
}

/** Items at or below their reorder level. */
export function lowStockItems(companyId?: string) {
  return getState().inventory
    .filter((i) => !companyId || !i.companyId || i.companyId === companyId)
    .map((item) => ({ item, onHand: stockOnHand(item.id) }))
    .filter(({ item, onHand }) => item.reorderLevel > 0 && onHand <= item.reorderLevel)
    .sort((a, b) => a.onHand - b.onHand);
}

export function addPurchaseOrder(x: Omit<PurchaseOrder, "id" | "createdAt" | "updatedAt">): PurchaseOrder {
  const s = getState();
  const now = new Date().toISOString();
  const row: PurchaseOrder = { ...x, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, purchaseOrders: [row, ...s.purchaseOrders] });
  void supabase.from("purchase_orders").insert({ id: row.id, ...toPurchaseOrder(row) })
    .then(({ error }) => fail("purchase_orders", error));
  addAuditLog("CREATE", "PurchaseOrder", row.id, `PO ${row.poNo} to ${row.supplier}`);
  return row;
}

export function updatePurchaseOrder(id: string, updates: Partial<PurchaseOrder>): PurchaseOrder | undefined {
  const s = getState();
  const existing = s.purchaseOrders.find((p) => p.id === id);
  if (!existing) return undefined;
  const updated: PurchaseOrder = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, purchaseOrders: s.purchaseOrders.map((p) => (p.id === id ? updated : p)) });
  void supabase.from("purchase_orders").update(toPurchaseOrder(updated)).eq("id", id)
    .then(({ error }) => fail("purchase_orders", error));
  addAuditLog("UPDATE", "PurchaseOrder", id, `PO ${updated.poNo} set to ${updated.status}`);
  return updated;
}

export function deletePurchaseOrder(id: string): boolean {
  const s = getState();
  if (!s.purchaseOrders.some((p) => p.id === id)) return false;
  setState({ ...s, purchaseOrders: s.purchaseOrders.filter((p) => p.id !== id) });
  void supabase.from("purchase_orders").delete().eq("id", id)
    .then(({ error }) => fail("purchase_orders", error));
  addAuditLog("DELETE", "PurchaseOrder", id, "Deleted purchase order");
  return true;
}

/** Mark a PO received and push the quantity into stock as an inbound movement. */
export function receivePurchaseOrder(id: string, receivedDate = new Date().toISOString().slice(0, 10)) {
  const po = getState().purchaseOrders.find((p) => p.id === id);
  if (!po) return undefined;
  const updated = updatePurchaseOrder(id, { status: "Received", receivedDate });
  if (po.itemId && po.quantity > 0) {
    addStockMovement({
      itemId: po.itemId, movementType: "In", quantity: po.quantity,
      movementDate: receivedDate, poId: po.id, referenceNo: po.poNo,
      remarks: `Received from ${po.supplier}`,
    });
  }
  return updated;
}

/** Total stock valuation at unit cost. */
export function inventoryValue(companyId?: string): number {
  return getState().inventory
    .filter((i) => !companyId || !i.companyId || i.companyId === companyId)
    .reduce((sum, i) => sum + stockOnHand(i.id) * (i.unitCost || 0), 0);
}

/* ---------------- Phase 14: analytics & reports ---------------- */

export type WorkforceByStatus = { status: Employee["status"]; count: number };

export function workforceByStatus(): WorkforceByStatus[] {
  const map = getState().employees.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  return Object.entries(map).map(([status, count]) => ({ status: status as Employee["status"], count }));
}

export function workforceByPassType(): { passType: string; count: number }[] {
  const map = getState().employees.reduce((acc, e) => {
    acc[e.passType] = (acc[e.passType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  return Object.entries(map).map(([passType, count]) => ({ passType, count }));
}

export function deploymentCoverage(): { site: string; required: number; assigned: number; gap: number }[] {
  return getState().sites.map((s) => {
    const assigned = getState().assignments.filter((a) => a.siteId === s.id && a.status === "Active").length;
    return { site: s.name, required: s.requiredWorkers, assigned, gap: Math.max(0, s.requiredWorkers - assigned) };
  });
}

export function passExpirySummary(days = 60): {
  total: number;
  expired: number;
  expiringSoon: number;
  valid: number;
  expiringList: Employee[];
} {
  const today = new Date();
  const threshold = new Date();
  threshold.setDate(today.getDate() + days);
  const employees = getState().employees;
  let expired = 0;
  let expiringSoon = 0;
  let valid = 0;
  const expiringList: Employee[] = [];
  for (const e of employees) {
    if (!e.passExpiry || e.passExpiry === "-") { valid++; continue; }
    const expiry = new Date(e.passExpiry);
    if (expiry < today) { expired++; expiringList.push(e); }
    else if (expiry <= threshold) { expiringSoon++; expiringList.push(e); }
    else valid++;
  }
  return { total: employees.length, expired, expiringSoon, valid, expiringList };
}

export function attendanceSummary(month?: string): {
  present: number;
  absent: number;
  onLeave: number;
  mc: number;
  halfDay: number;
  total: number;
} {
  const rows = month ? getState().attendance.filter((a) => a.date.startsWith(month)) : getState().attendance;
  const counts = { present: 0, absent: 0, onLeave: 0, mc: 0, halfDay: 0, total: rows.length };
  for (const a of rows) {
    if (a.status === "Present") counts.present++;
    else if (a.status === "Absent") counts.absent++;
    else if (a.status === "On Leave") counts.onLeave++;
    else if (a.status === "MC") counts.mc++;
    else if (a.status === "Half Day") counts.halfDay++;
  }
  return counts;
}

export function leaveSummary(): {
  type: LeaveRequest["type"];
  requested: number;
  approved: number;
  rejected: number;
  days: number;
}[] {
  const map = new Map<LeaveRequest["type"], { requested: number; approved: number; rejected: number; days: number }>();
  for (const l of getState().leaveRequests) {
    const entry = map.get(l.type) || { requested: 0, approved: 0, rejected: 0, days: 0 };
    entry.requested++;
    entry.days += l.days;
    if (l.status === "Approved") entry.approved++;
    if (l.status === "Rejected") entry.rejected++;
    map.set(l.type, entry);
  }
  return Array.from(map.entries()).map(([type, stats]) => ({ type, ...stats }));
}

export function payrollTrendSummary(): { month: string; basic: number; overtime: number; levies: number; cpf: number; net: number }[] {
  const map = new Map<string, { basic: number; overtime: number; levies: number; cpf: number; net: number }>();
  for (const p of getState().payroll) {
    const entry = map.get(p.month) || { basic: 0, overtime: 0, levies: 0, cpf: 0, net: 0 };
    entry.basic += p.basicSalary;
    entry.overtime += p.overtimePay;
    entry.levies += p.levies;
    entry.cpf += p.cpfEmployee;
    entry.net += p.netPay;
    map.set(p.month, entry);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, values]) => ({ month, ...values }));
}

export function expenseByCategory(): { category: Expense["category"]; amount: number; count: number }[] {
  const map = new Map<Expense["category"], { amount: number; count: number }>();
  for (const e of getState().expenses) {
    if (e.status === "Paid") {
      const entry = map.get(e.category) || { amount: 0, count: 0 };
      entry.amount += e.amount;
      entry.count++;
      map.set(e.category, entry);
    }
  }
  return Array.from(map.entries()).map(([category, values]) => ({ category, ...values })).sort((a, b) => b.amount - a.amount);
}

export function safetySummary(): { total: number; momReported: number; bySeverity: Record<string, number> } {
  const incidents = getState().incidents;
  const bySeverity: Record<string, number> = {};
  let momReported = 0;
  for (const i of incidents) {
    bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
    if (i.momReported) momReported++;
  }
  return { total: incidents.length, momReported, bySeverity };
}

export function trainingCompliance(): { total: number; valid: number; expiringSoon: number; expired: number } {
  const today = new Date();
  const threshold = new Date();
  threshold.setDate(today.getDate() + 60);
  let valid = 0, expiringSoon = 0, expired = 0;
  for (const t of getState().trainings) {
    if (!t.expiryDate) { valid++; continue; }
    const expiry = new Date(t.expiryDate);
    if (expiry < today) expired++;
    else if (expiry <= threshold) expiringSoon++;
    else valid++;
  }
  return { total: getState().trainings.length, valid, expiringSoon, expired };
}

export function fleetAvailability(): { total: number; available: number; inWorkshop: number; inactive: number } {
  const vehicles = getState().vehicles;
  let available = 0, inWorkshop = 0, inactive = 0;
  for (const v of vehicles) {
    if (v.status === "Active") available++;
    else if (v.status === "In Workshop") inWorkshop++;
    else inactive++;
  }
  return { total: vehicles.length, available, inWorkshop, inactive };
}

export function dormitoryOccupancy(): { totalBeds: number; occupied: number; vacant: number; occupancyRate: number }[] {
  return getState().dormitories.map((d) => {
    const occupied = getState().allocations.filter((a) => a.dormitoryId === d.id && a.status === "Occupied").length;
    const totalBeds = d.capacity;
    return { totalBeds, occupied, vacant: totalBeds - occupied, occupancyRate: totalBeds ? Math.round((occupied / totalBeds) * 100) : 0 };
  });
}

export function assetSummary(): { total: number; issued: number; available: number; value: number } {
  const assets = getState().assets;
  const issued = getState().issuances.filter((i) => i.status === "Issued").reduce((sum, i) => sum + i.quantity, 0);
  return { total: assets.length, issued, available: assets.length - issued, value: assets.reduce((s, a) => s + a.unitCost * a.quantity, 0) };
}

/* ---------------- courses & certifications ---------------- */
export function getCertifications(): EmployeeCertification[] { return getState().certifications; }
export function getCertificationsByEmployee(employeeId: string): EmployeeCertification[] {
  return getState().certifications.filter((c) => c.employeeId === employeeId);
}

export function addCertification(x: Omit<EmployeeCertification, "id">): EmployeeCertification {
  const s = getState();
  const row: EmployeeCertification = { ...x, id: newId() };
  setState({ ...s, certifications: [row, ...s.certifications] });
  void supabase.from("employee_certifications").insert({ id: row.id, ...toCertification(row) }).then(({ error }) => fail("employee_certifications", error));
  addAuditLog("CREATE", "Certification", row.id, `Added certification ${row.courseName}`);
  return row;
}

export function updateCertification(id: string, updates: Partial<EmployeeCertification>): EmployeeCertification | undefined {
  const s = getState();
  const existing = s.certifications.find((c) => c.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates };
  setState({ ...s, certifications: s.certifications.map((c) => (c.id === id ? updated : c)) });
  void supabase.from("employee_certifications").update(toCertification(updated)).eq("id", id).then(({ error }) => fail("employee_certifications", error));
  addAuditLog("UPDATE", "Certification", id, `Updated certification ${updated.courseName}`);
  return updated;
}

export function deleteCertification(id: string): boolean {
  const s = getState();
  const row = s.certifications.find((c) => c.id === id);
  if (!row) return false;
  setState({ ...s, certifications: s.certifications.filter((c) => c.id !== id) });
  void supabase.from("employee_certifications").delete().eq("id", id).then(({ error }) => fail("employee_certifications", error));
  addAuditLog("DELETE", "Certification", id, `Removed certification ${row.courseName}`);
  return true;
}

export function certificationStatus(expiry?: string): "Valid" | "Expiring Soon" | "Expired" | "No expiry" {
  if (!expiry) return "No expiry";
  const days = Math.round((new Date(`${expiry}T00:00:00+08:00`).getTime() - Date.now()) / 86_400_000);
  if (Number.isNaN(days)) return "No expiry";
  if (days < 0) return "Expired";
  if (days <= 60) return "Expiring Soon";
  return "Valid";
}

/* ---------------- time cards (physical card verification) ---------------- */
export function getTimeCards(): TimeCard[] { return getState().timeCards; }
export function getTimeCardsByEmployee(employeeId: string): TimeCard[] {
  return getState().timeCards.filter((t) => t.employeeId === employeeId);
}

export function addTimeCard(x: Omit<TimeCard, "id">): TimeCard {
  const s = getState();
  const row: TimeCard = { ...x, id: newId() };
  setState({ ...s, timeCards: [row, ...s.timeCards] });
  void supabase.from("time_cards").insert({ id: row.id, ...toTimeCard(row) }).then(({ error }) => fail("time_cards", error));
  addAuditLog("CREATE", "TimeCard", row.id, `Uploaded time card ${row.periodStart} → ${row.periodEnd}`);
  return row;
}

export function updateTimeCard(id: string, updates: Partial<TimeCard>): TimeCard | undefined {
  const s = getState();
  const existing = s.timeCards.find((t) => t.id === id);
  if (!existing) return undefined;
  const updated = { ...existing, ...updates };
  setState({ ...s, timeCards: s.timeCards.map((t) => (t.id === id ? updated : t)) });
  void supabase.from("time_cards").update(toTimeCard(updated)).eq("id", id).then(({ error }) => fail("time_cards", error));
  return updated;
}

export function deleteTimeCard(id: string): boolean {
  const s = getState();
  if (!s.timeCards.some((t) => t.id === id)) return false;
  setState({ ...s, timeCards: s.timeCards.filter((t) => t.id !== id) });
  void supabase.from("time_cards").delete().eq("id", id).then(({ error }) => fail("time_cards", error));
  addAuditLog("DELETE", "TimeCard", id, "Deleted time card");
  return true;
}

export type TimeCardComparison = {
  date: string;
  cardIn?: string;
  cardOut?: string;
  systemIn?: string;
  systemOut?: string;
  state: "Verified" | "Mismatch" | "Missing in system" | "Missing on card";
  resolution?: TimeCard["entries"][number]["resolution"];
};

const hhmm = (v?: string) => (v ? v.slice(0, 5) : "");

/** Compare a manually-typed (or later OCR-filled) card against system attendance. */
export function compareTimeCard(card: TimeCard): TimeCardComparison[] {
  const system = getAttendanceByEmployee(card.employeeId).filter(
    (a) => a.date >= card.periodStart && a.date <= card.periodEnd,
  );
  const dates = new Set<string>([...card.entries.map((e) => e.date), ...system.map((a) => a.date)]);
  return [...dates]
    .filter(Boolean)
    .sort()
    .map((date) => {
      const entry = card.entries.find((e) => e.date === date);
      const att = system.find((a) => a.date === date);
      const cardIn = hhmm(entry?.checkIn);
      const cardOut = hhmm(entry?.checkOut);
      const systemIn = hhmm(att?.checkIn);
      const systemOut = hhmm(att?.checkOut);
      let state: TimeCardComparison["state"];
      if (!att) state = "Missing in system";
      else if (!entry || (!cardIn && !cardOut)) state = "Missing on card";
      else if (cardIn === systemIn && cardOut === systemOut) state = "Verified";
      else state = "Mismatch";
      return { date, cardIn, cardOut, systemIn, systemOut, state, resolution: entry?.resolution };
    });
}

/* ---------------- claim sheets ---------------- */
export function getClaimSheets(): ClaimSheet[] { return getState().claimSheets; }

export function buildClaimSheetRows(employeeId: string, from: string, to: string) {
  const sites = getState().sites;
  return getAttendanceByEmployee(employeeId)
    .filter((a) => a.date >= from && a.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((a) => ({
      date: a.date,
      checkIn: a.checkIn,
      checkOut: a.checkOut,
      normalHours: a.hoursWorked,
      otHours: a.overtimeHours,
      status: a.status,
      site: sites.find((s) => s.id === a.siteId)?.name,
    }));
}

export function addClaimSheet(x: Omit<ClaimSheet, "id" | "reference"> & { reference?: string }): ClaimSheet {
  const s = getState();
  const reference = x.reference || `CS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${s.claimSheets.length + 1}`;
  const row: ClaimSheet = { ...x, reference, id: newId() };
  setState({ ...s, claimSheets: [row, ...s.claimSheets] });
  void supabase.from("claim_sheets").insert({ id: row.id, ...toClaimSheet(row) }).then(({ error }) => fail("claim_sheets", error));
  addAuditLog("CREATE", "ClaimSheet", row.id, `Generated claim sheet ${reference}`);
  return row;
}

export function deleteClaimSheet(id: string): boolean {
  const s = getState();
  if (!s.claimSheets.some((c) => c.id === id)) return false;
  setState({ ...s, claimSheets: s.claimSheets.filter((c) => c.id !== id) });
  void supabase.from("claim_sheets").delete().eq("id", id).then(({ error }) => fail("claim_sheets", error));
  return true;
}



/* ---------------- loan / salary advance ledger ---------------- */
export function getLoans(): EmployeeLoan[] { return getState().loans; }
export function getLoanRepayments(): LoanRepayment[] { return getState().loanRepayments; }

export function addLoan(
  loan: Omit<EmployeeLoan, "id" | "loanNo" | "createdAt" | "updatedAt"> & { loanNo?: string },
): EmployeeLoan {
  const s = getState();
  const now = new Date().toISOString();
  const loanNo = loan.loanNo?.trim() || `LN-${String(s.loans.length + 1).padStart(4, "0")}`;
  const row: EmployeeLoan = { ...loan, loanNo, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, loans: [row, ...s.loans] });
  void supabase.from("employee_loans").insert({ id: row.id, ...toLoan(row) })
    .then(({ error }) => fail("employee_loans", error));
  addAuditLog("CREATE", "EmployeeLoan", row.id, `Loan ${loanNo} — $${row.principal}`);
  return row;
}

export function updateLoan(id: string, updates: Partial<EmployeeLoan>): EmployeeLoan | undefined {
  const s = getState();
  const existing = s.loans.find((l) => l.id === id);
  if (!existing) return undefined;
  const updated: EmployeeLoan = { ...existing, ...updates, updatedAt: new Date().toISOString() };
  setState({ ...s, loans: s.loans.map((l) => (l.id === id ? updated : l)) });
  void supabase.from("employee_loans").update(toLoan(updated)).eq("id", id)
    .then(({ error }) => fail("employee_loans", error));
  addAuditLog("UPDATE", "EmployeeLoan", id, `Loan ${updated.loanNo} updated`);
  return updated;
}

export function deleteLoan(id: string): boolean {
  const s = getState();
  if (!s.loans.some((l) => l.id === id)) return false;
  setState({
    ...s,
    loans: s.loans.filter((l) => l.id !== id),
    loanRepayments: s.loanRepayments.filter((p) => p.loanId !== id),
  });
  void supabase.from("employee_loans").delete().eq("id", id)
    .then(({ error }) => fail("employee_loans", error));
  addAuditLog("DELETE", "EmployeeLoan", id, "Deleted loan");
  return true;
}

export function addLoanRepayment(
  payment: Omit<LoanRepayment, "id" | "createdAt" | "updatedAt">,
): LoanRepayment {
  const s = getState();
  const now = new Date().toISOString();
  const row: LoanRepayment = { ...payment, id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, loanRepayments: [row, ...s.loanRepayments] });
  void supabase.from("loan_repayments").insert({ id: row.id, ...toLoanRepayment(row) })
    .then(({ error }) => fail("loan_repayments", error));
  addAuditLog("CREATE", "LoanRepayment", row.id, `Repayment $${row.amount} (${row.source})`);

  // Auto-settle the loan once fully recovered.
  const loan = getState().loans.find((l) => l.id === row.loanId);
  if (loan && loan.status === "Active") {
    const paid = getState().loanRepayments
      .filter((p) => p.loanId === loan.id)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    if (paid >= loan.principal - 0.01) updateLoan(loan.id, { status: "Settled" });
  }
  return row;
}

export function deleteLoanRepayment(id: string): boolean {
  const s = getState();
  if (!s.loanRepayments.some((p) => p.id === id)) return false;
  setState({ ...s, loanRepayments: s.loanRepayments.filter((p) => p.id !== id) });
  void supabase.from("loan_repayments").delete().eq("id", id)
    .then(({ error }) => fail("loan_repayments", error));
  addAuditLog("DELETE", "LoanRepayment", id, "Deleted loan repayment");
  return true;
}

/* ---------------- organisation: departments & designations ---------------- */
export function getDepartments(): Department[] { return getState().departments; }
export function getDesignations(): Designation[] { return getState().designations; }

export function addDepartment(x: Omit<Department, "id" | "createdAt" | "updatedAt">): Department {
  const s = getState();
  const now = new Date().toISOString();
  const row: Department = { ...x, code: (x.code ?? "").toUpperCase(), id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, departments: [row, ...s.departments] });
  void supabase.from("departments").insert({ id: row.id, ...toDepartment(row) })
    .then(({ error }) => fail("departments", error));
  addAuditLog("CREATE", "Department", row.id, `Added department ${row.name}`);
  return row;
}

export function updateDepartment(id: string, updates: Partial<Department>): Department | undefined {
  const s = getState();
  const existing = s.departments.find((d) => d.id === id);
  if (!existing) return undefined;
  const updated: Department = {
    ...existing, ...updates,
    code: (updates.code ?? existing.code ?? "").toUpperCase(),
    updatedAt: new Date().toISOString(),
  };
  setState({ ...s, departments: s.departments.map((d) => (d.id === id ? updated : d)) });
  void supabase.from("departments").update(toDepartment(updated)).eq("id", id)
    .then(({ error }) => fail("departments", error));
  addAuditLog("UPDATE", "Department", id, `Updated department ${updated.name}`);
  return updated;
}

export function deleteDepartment(id: string) {
  const s = getState();
  const target = s.departments.find((d) => d.id === id);
  setState({
    ...s,
    departments: s.departments.filter((d) => d.id !== id),
    designations: s.designations.map((g) => (g.departmentId === id ? { ...g, departmentId: undefined } : g)),
  });
  void supabase.from("departments").delete().eq("id", id).then(({ error }) => fail("departments", error));
  if (target) addAuditLog("DELETE", "Department", id, `Deleted department ${target.name}`);
}

export function addDesignation(x: Omit<Designation, "id" | "createdAt" | "updatedAt">): Designation {
  const s = getState();
  const now = new Date().toISOString();
  const row: Designation = { ...x, code: (x.code ?? "").toUpperCase(), id: newId(), createdAt: now, updatedAt: now };
  setState({ ...s, designations: [row, ...s.designations] });
  void supabase.from("designations").insert({ id: row.id, ...toDesignation(row) })
    .then(({ error }) => fail("designations", error));
  addAuditLog("CREATE", "Designation", row.id, `Added designation ${row.title}`);
  return row;
}

export function updateDesignation(id: string, updates: Partial<Designation>): Designation | undefined {
  const s = getState();
  const existing = s.designations.find((d) => d.id === id);
  if (!existing) return undefined;
  const updated: Designation = {
    ...existing, ...updates,
    code: (updates.code ?? existing.code ?? "").toUpperCase(),
    updatedAt: new Date().toISOString(),
  };
  setState({ ...s, designations: s.designations.map((d) => (d.id === id ? updated : d)) });
  void supabase.from("designations").update(toDesignation(updated)).eq("id", id)
    .then(({ error }) => fail("designations", error));
  addAuditLog("UPDATE", "Designation", id, `Updated designation ${updated.title}`);
  return updated;
}

export function deleteDesignation(id: string) {
  const s = getState();
  const target = s.designations.find((d) => d.id === id);
  setState({ ...s, designations: s.designations.filter((d) => d.id !== id) });
  void supabase.from("designations").delete().eq("id", id).then(({ error }) => fail("designations", error));
  if (target) addAuditLog("DELETE", "Designation", id, `Deleted designation ${target.title}`);
}
