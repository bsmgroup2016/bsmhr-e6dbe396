import type {
  Employee,
  Client,
  Project,
  Site,
  Assignment,
  EmployeeDocument,
  Attendance,
  PayrollEntry,
  Approval,
  AuditLog,
  User,
  AppBranch,
  Company,
} from "@/lib/types";

const STORAGE_KEY = "bsm-app-state-v1";

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
  users: User[];
  branches: AppBranch[];
  currentBranch: string;
  companies: Company[];
  currentCompany: string;
  currentUser: User | null;
}

const defaultCompanies: Company[] = [
  {
    id: "bsm",
    code: "BSM",
    name: "BSM Engineering",
    legalName: "BSM Engineering Pte Ltd",
    uen: "201812345K",
    industry: "Marine & Engineering",
    address: "12 Tuas Ave 8, Singapore 639234",
    phone: "+65 6123 4567",
    email: "info@bsm.com.sg",
    status: "Active",
    accent: "primary",
    createdAt: "2018-01-01",
    updatedAt: "2018-01-01",
  },
  {
    id: "vrl",
    code: "VRL",
    name: "VRL Manpower",
    legalName: "VRL Manpower Services Pte Ltd",
    uen: "202054321H",
    industry: "Manpower Supply",
    address: "88 Jurong East St 21, Singapore 609607",
    phone: "+65 6234 5678",
    email: "info@vrl.com.sg",
    status: "Active",
    accent: "info",
    createdAt: "2020-03-01",
    updatedAt: "2020-03-01",
  },
  {
    id: "pluto",
    code: "PLT",
    name: "Pluto Construction",
    legalName: "Pluto Construction Pte Ltd",
    uen: "202198765M",
    industry: "Construction",
    address: "5 Changi Business Park, Singapore 486040",
    phone: "+65 6345 6789",
    email: "info@pluto.com.sg",
    status: "Active",
    accent: "success",
    createdAt: "2021-06-01",
    updatedAt: "2021-06-01",
  },
];

const defaultBranches: AppBranch[] = [
  { id: "hq", name: "Headquarters", location: "Singapore", status: "Active" },
  { id: "east", name: "East Branch", location: "Tampines", status: "Active" },
  { id: "west", name: "West Branch", location: "Jurong", status: "Active" },
];

const defaultUsers: User[] = [
  { id: "u1", name: "Admin User", email: "admin@bsm.com", role: "admin", status: "active", branch: "hq", createdAt: "2025-01-01" },
  { id: "u2", name: "HR Manager", email: "hr@bsm.com", role: "hr", status: "active", branch: "hq", createdAt: "2025-01-01" },
  { id: "u3", name: "Payroll Officer", email: "payroll@bsm.com", role: "payroll", status: "active", branch: "hq", createdAt: "2025-01-01" },
  { id: "u4", name: "Site Supervisor", email: "supervisor@bsm.com", role: "supervisor", status: "active", branch: "east", createdAt: "2025-01-01" },
];

const defaultEmployees: Employee[] = [
  { id: "e1", employeeCode: "BSM-0001", name: "Mohammed Rahman", nationality: "Bangladesh", fin: "G1234567X", passType: "Work Permit", passExpiry: "2026-09-14", trade: "Welder", site: "Tuas Mega Port", status: "Deployed", basicSalary: 1450, joinedOn: "2023-03-11", phone: "+65 8123 4567", branch: "west", levyRate: 450, createdAt: "2023-03-11", updatedAt: "2023-03-11" },
  { id: "e2", employeeCode: "BSM-0002", name: "Arun Kumar", nationality: "India", fin: "G7654321Y", passType: "S Pass", passExpiry: "2027-02-28", trade: "Site Supervisor", site: "Jurong Island Ph.2", status: "Deployed", basicSalary: 3200, joinedOn: "2022-07-01", phone: "+65 8234 5678", branch: "west", levyRate: 0, createdAt: "2022-07-01", updatedAt: "2022-07-01" },
  { id: "e3", employeeCode: "BSM-0003", name: "Zaw Min Htet", nationality: "Myanmar", fin: "G2233445Z", passType: "Work Permit", passExpiry: "2026-08-05", trade: "Pipe Fitter", site: "Tuas Mega Port", status: "Active", basicSalary: 1380, joinedOn: "2024-01-22", phone: "+65 8345 6789", branch: "west", levyRate: 450, createdAt: "2024-01-22", updatedAt: "2024-01-22" },
  { id: "e4", employeeCode: "BSM-0004", name: "Lim Wei Sheng", nationality: "Singapore", fin: "S8812345A", passType: "Singaporean/PR", passExpiry: "-", trade: "Project Engineer", site: "Changi T5 Works", status: "Active", basicSalary: 5200, joinedOn: "2021-05-17", phone: "+65 8456 7890", branch: "east", levyRate: 0, createdAt: "2021-05-17", updatedAt: "2021-05-17" },
  { id: "e5", employeeCode: "BSM-0005", name: "Suresh Nair", nationality: "India", fin: "G3344556B", passType: "Work Permit", passExpiry: "2026-08-19", trade: "Scaffolder", site: null, status: "On Leave", basicSalary: 1300, joinedOn: "2023-11-02", phone: "+65 8567 8901", branch: "west", levyRate: 450, createdAt: "2023-11-02", updatedAt: "2023-11-02" },
  { id: "e6", employeeCode: "BSM-0006", name: "Chen Guo Qiang", nationality: "China", fin: "G4455667C", passType: "Work Permit", passExpiry: "2027-05-30", trade: "Rigger", site: "Jurong Island Ph.2", status: "Deployed", basicSalary: 1500, joinedOn: "2022-09-14", phone: "+65 8678 9012", branch: "west", levyRate: 450, createdAt: "2022-09-14", updatedAt: "2022-09-14" },
  { id: "e7", employeeCode: "BSM-0007", name: "Abdul Karim", nationality: "Bangladesh", fin: "G5566778D", passType: "Work Permit", passExpiry: "2026-12-01", trade: "General Worker", site: null, status: "Active", basicSalary: 1150, joinedOn: "2025-02-03", phone: "+65 8789 0123", branch: "east", levyRate: 450, createdAt: "2025-02-03", updatedAt: "2025-02-03" },
  { id: "e8", employeeCode: "BSM-0008", name: "Rajesh Pillai", nationality: "India", fin: "G6677889E", passType: "Employment Pass", passExpiry: "2028-01-15", trade: "QA/QC Manager", site: "Changi T5 Works", status: "Deployed", basicSalary: 6800, joinedOn: "2020-10-09", phone: "+65 8890 1234", branch: "east", levyRate: 0, createdAt: "2020-10-09", updatedAt: "2020-10-09" },
  { id: "e9", employeeCode: "BSM-0009", name: "Htun Naing", nationality: "Myanmar", fin: "G7788990F", passType: "Work Permit", passExpiry: "2026-07-31", trade: "Welder", site: "Tuas Mega Port", status: "Deployed", basicSalary: 1420, joinedOn: "2024-06-18", phone: "+65 8901 2345", branch: "west", levyRate: 450, createdAt: "2024-06-18", updatedAt: "2024-06-18" },
  { id: "e10", employeeCode: "BSM-0010", name: "Tan Boon Hock", nationality: "Singapore", fin: "S7723456B", passType: "Singaporean/PR", passExpiry: "-", trade: "Safety Officer", site: "Jurong Island Ph.2", status: "Active", basicSalary: 4400, joinedOn: "2019-04-25", phone: "+65 9012 3456", branch: "west", levyRate: 0, createdAt: "2019-04-25", updatedAt: "2019-04-25" },
  { id: "e11", employeeCode: "BSM-0011", name: "Mizanur Islam", nationality: "Bangladesh", fin: "G8899001G", passType: "Work Permit", passExpiry: "2027-03-22", trade: "Painter", site: null, status: "Inactive", basicSalary: 1200, joinedOn: "2023-08-30", phone: "+65 9123 4567", branch: "east", levyRate: 450, createdAt: "2023-08-30", updatedAt: "2023-08-30" },
  { id: "e12", employeeCode: "BSM-0012", name: "Vignesh Raja", nationality: "India", fin: "G9900112H", passType: "S Pass", passExpiry: "2026-10-11", trade: "Foreman", site: "Changi T5 Works", status: "Deployed", basicSalary: 3050, joinedOn: "2022-02-12", phone: "+65 9234 5678", branch: "east", levyRate: 0, createdAt: "2022-02-12", updatedAt: "2022-02-12" },
];

const defaultClients: Client[] = [
  { id: "c1", code: "CLI-001", name: "Tuas Port Authority", contactPerson: "John Lim", email: "john.lim@tuasport.sg", phone: "+65 6123 4567", address: "Tuas South Boulevard, Singapore", status: "Active", industry: "Construction", contractStart: "2024-01-01", contractEnd: "2027-12-31", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  { id: "c2", code: "CLI-002", name: "Jurong Island Consortium", contactPerson: "Sarah Tan", email: "sarah.tan@jic.sg", phone: "+65 6234 5678", address: "Jurong Island, Singapore", status: "Active", industry: "Petrochemical", contractStart: "2023-06-01", contractEnd: "2026-05-31", createdAt: "2023-06-01", updatedAt: "2023-06-01" },
  { id: "c3", code: "CLI-003", name: "Changi Airport Group", contactPerson: "Michael Wong", email: "michael.wong@cag.sg", phone: "+65 6345 6789", address: "Changi Airport, Singapore", status: "Active", industry: "Aviation", contractStart: "2025-01-01", contractEnd: "2028-12-31", createdAt: "2025-01-01", updatedAt: "2025-01-01" },
  { id: "c4", code: "CLI-004", name: "Sembcorp Industries", contactPerson: "David Lee", email: "david.lee@sembcorp.sg", phone: "+65 6456 7890", address: "HarbourFront, Singapore", status: "Prospect", industry: "Utilities", createdAt: "2025-05-01", updatedAt: "2025-05-01" },
];

const defaultProjects: Project[] = [
  { id: "p1", clientId: "c1", code: "PRJ-001", name: "Tuas Mega Port Expansion", location: "Tuas South", status: "Active", startDate: "2024-01-01", endDate: "2027-12-31", requiredWorkers: 120, projectManager: "Arun Kumar", safetyOfficer: "Tan Boon Hock", createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  { id: "p2", clientId: "c2", code: "PRJ-002", name: "Jurong Island Phase 2", location: "Jurong Island", status: "Active", startDate: "2023-06-01", endDate: "2026-05-31", requiredWorkers: 85, projectManager: "Rajesh Pillai", safetyOfficer: "Tan Boon Hock", createdAt: "2023-06-01", updatedAt: "2023-06-01" },
  { id: "p3", clientId: "c3", code: "PRJ-003", name: "Changi T5 Works", location: "Changi", status: "Active", startDate: "2025-01-01", endDate: "2028-12-31", requiredWorkers: 200, projectManager: "Lim Wei Sheng", safetyOfficer: "Tan Boon Hock", createdAt: "2025-01-01", updatedAt: "2025-01-01" },
  { id: "p4", clientId: "c4", code: "PRJ-004", name: "HarbourFront Utilities", location: "HarbourFront", status: "Planning", startDate: "2025-09-01", endDate: "2026-08-31", requiredWorkers: 45, createdAt: "2025-05-01", updatedAt: "2025-05-01" },
];

const defaultSites: Site[] = [
  { id: "s1", projectId: "p1", code: "SITE-001", name: "Tuas Mega Port - Zone A", location: "Tuas South Boulevard", status: "Active", supervisorId: "u4", requiredWorkers: 60, createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  { id: "s2", projectId: "p1", code: "SITE-002", name: "Tuas Mega Port - Zone B", location: "Tuas South Boulevard", status: "Active", requiredWorkers: 40, createdAt: "2024-01-01", updatedAt: "2024-01-01" },
  { id: "s3", projectId: "p2", code: "SITE-003", name: "Jurong Island Ph.2 - Main", location: "Jurong Island", status: "Active", supervisorId: "u4", requiredWorkers: 85, createdAt: "2023-06-01", updatedAt: "2023-06-01" },
  { id: "s4", projectId: "p3", code: "SITE-004", name: "Changi T5 - Terminal", location: "Changi Airport", status: "Active", requiredWorkers: 120, createdAt: "2025-01-01", updatedAt: "2025-01-01" },
  { id: "s5", projectId: "p3", code: "SITE-005", name: "Changi T5 - Cargo", location: "Changi Airport", status: "Active", requiredWorkers: 80, createdAt: "2025-01-01", updatedAt: "2025-01-01" },
];

const defaultAssignments: Assignment[] = [
  { id: "a1", employeeId: "e1", siteId: "s1", projectId: "p1", startDate: "2024-01-15", status: "Active", approvedBy: "u1", approvedAt: "2024-01-14", createdAt: "2024-01-15", updatedAt: "2024-01-15" },
  { id: "a2", employeeId: "e2", siteId: "s3", projectId: "p2", startDate: "2023-06-15", status: "Active", approvedBy: "u1", approvedAt: "2023-06-14", createdAt: "2023-06-15", updatedAt: "2023-06-15" },
  { id: "a3", employeeId: "e6", siteId: "s3", projectId: "p2", startDate: "2024-03-01", status: "Active", approvedBy: "u1", approvedAt: "2024-02-28", createdAt: "2024-03-01", updatedAt: "2024-03-01" },
  { id: "a4", employeeId: "e8", siteId: "s4", projectId: "p3", startDate: "2025-01-15", status: "Active", approvedBy: "u1", approvedAt: "2025-01-14", createdAt: "2025-01-15", updatedAt: "2025-01-15" },
  { id: "a5", employeeId: "e12", siteId: "s4", projectId: "p3", startDate: "2025-02-01", status: "Active", approvedBy: "u1", approvedAt: "2025-01-31", createdAt: "2025-02-01", updatedAt: "2025-02-01" },
  { id: "a6", employeeId: "e9", siteId: "s1", projectId: "p1", startDate: "2024-07-01", status: "Active", approvedBy: "u1", approvedAt: "2024-06-30", createdAt: "2024-07-01", updatedAt: "2024-07-01" },
  { id: "a7", employeeId: "e10", siteId: "s3", projectId: "p2", startDate: "2023-06-01", status: "Active", approvedBy: "u1", approvedAt: "2023-05-31", createdAt: "2023-06-01", updatedAt: "2023-06-01" },
];

const defaultDocuments: EmployeeDocument[] = [
  { id: "d1", employeeId: "e1", type: "Work Permit", name: "Work Permit - Mohammed Rahman", expiryDate: "2026-09-14", status: "Valid", uploadedAt: "2023-03-11", updatedAt: "2023-03-11" },
  { id: "d2", employeeId: "e1", type: "Passport", name: "Passport - Mohammed Rahman", expiryDate: "2028-03-11", status: "Valid", uploadedAt: "2023-03-11", updatedAt: "2023-03-11" },
  { id: "d3", employeeId: "e3", type: "Work Permit", name: "Work Permit - Zaw Min Htet", expiryDate: "2026-08-05", status: "Expiring Soon", uploadedAt: "2024-01-22", updatedAt: "2024-01-22" },
  { id: "d4", employeeId: "e5", type: "Work Permit", name: "Work Permit - Suresh Nair", expiryDate: "2026-08-19", status: "Expiring Soon", uploadedAt: "2023-11-02", updatedAt: "2023-11-02" },
  { id: "d5", employeeId: "e9", type: "Work Permit", name: "Work Permit - Htun Naing", expiryDate: "2026-07-31", status: "Expired", uploadedAt: "2024-06-18", updatedAt: "2024-06-18" },
  { id: "d6", employeeId: "e12", type: "S Pass", name: "S Pass - Vignesh Raja", expiryDate: "2026-10-11", status: "Expiring Soon", uploadedAt: "2022-02-12", updatedAt: "2022-02-12" },
];

const defaultApprovals: Approval[] = [
  { id: "ap1", type: "Assignment", title: "Deploy Abdul Karim to Tuas Mega Port", requestedBy: "u4", requestedByName: "Site Supervisor", requestedAt: "2026-07-25T10:00:00", status: "Pending", payload: "Employee: BSM-0007, Site: Tuas Mega Port - Zone A", createdAt: "2026-07-25T10:00:00", updatedAt: "2026-07-25T10:00:00" },
  { id: "ap2", type: "Leave", title: "Leave request - Suresh Nair (BSM-0005)", requestedBy: "u4", requestedByName: "Site Supervisor", requestedAt: "2026-07-24T09:30:00", status: "Approved", payload: "Dates: 2026-07-25 to 2026-08-05", approverId: "u2", approverName: "HR Manager", approverNotes: "Approved", decidedAt: "2026-07-24T14:00:00", createdAt: "2026-07-24T09:30:00", updatedAt: "2026-07-24T14:00:00" },
  { id: "ap3", type: "Payroll", title: "July 2026 payroll run", requestedBy: "u3", requestedByName: "Payroll Officer", requestedAt: "2026-07-28T08:00:00", status: "Pending", payload: "Month: 2026-07, Total employees: 248", createdAt: "2026-07-28T08:00:00", updatedAt: "2026-07-28T08:00:00" },
  { id: "ap4", type: "Overtime", title: "Overtime claim - Tuas Mega Port", requestedBy: "u4", requestedByName: "Site Supervisor", requestedAt: "2026-07-27T16:00:00", status: "Escalated", payload: "Total OT hours: 120, Site: Tuas Mega Port - Zone A", createdAt: "2026-07-27T16:00:00", updatedAt: "2026-07-27T16:00:00" },
];

const defaultAuditLogs: AuditLog[] = [
  { id: "al1", action: "CREATE", entityType: "Employee", entityId: "e1", userId: "u2", userName: "HR Manager", timestamp: "2026-07-28T08:00:00", details: "Created employee Mohammed Rahman" },
  { id: "al2", action: "UPDATE", entityType: "Assignment", entityId: "a1", userId: "u1", userName: "Admin User", timestamp: "2026-07-28T09:00:00", details: "Updated assignment status to Active" },
  { id: "al3", action: "APPROVE", entityType: "Approval", entityId: "ap2", userId: "u2", userName: "HR Manager", timestamp: "2026-07-24T14:00:00", details: "Approved leave request" },
];

const defaultAttendance: Attendance[] = [];
const defaultPayroll: PayrollEntry[] = [];

const initialState: AppState = {
  employees: defaultEmployees,
  clients: defaultClients,
  projects: defaultProjects,
  sites: defaultSites,
  assignments: defaultAssignments,
  documents: defaultDocuments,
  attendance: defaultAttendance,
  payroll: defaultPayroll,
  approvals: defaultApprovals,
  auditLogs: defaultAuditLogs,
  users: defaultUsers,
  branches: defaultBranches,
  currentBranch: "hq",
  companies: defaultCompanies,
  currentCompany: "bsm",
  currentUser: defaultUsers[0],
};

function getState(): AppState {
  if (typeof window === "undefined") return initialState;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initialState;
    const parsed = JSON.parse(raw) as AppState;
    // Merge with initial state to ensure new fields are present
    return { ...initialState, ...parsed, currentUser: parsed.currentUser || defaultUsers[0] };
  } catch {
    return initialState;
  }
}

function setState(state: AppState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getEmployees(): Employee[] {
  return getState().employees;
}

export function getEmployee(id: string): Employee | undefined {
  return getState().employees.find((e) => e.id === id);
}

export function addEmployee(employee: Omit<Employee, "id" | "employeeCode" | "createdAt" | "updatedAt">): Employee {
  const state = getState();
  const nextCode = `BSM-${String(state.employees.length + 1).padStart(4, "0")}`;
  const now = new Date().toISOString();
  const newEmployee: Employee = {
    ...employee,
    id: generateId("e"),
    employeeCode: nextCode,
    createdAt: now,
    updatedAt: now,
  };
  const newState = { ...state, employees: [...state.employees, newEmployee] };
  setState(newState);
  addAuditLog("CREATE", "Employee", newEmployee.id, `Created employee ${newEmployee.name} (${newEmployee.employeeCode})`);
  return newEmployee;
}

export function updateEmployee(id: string, updates: Partial<Employee>): Employee | undefined {
  const state = getState();
  const index = state.employees.findIndex((e) => e.id === id);
  if (index === -1) return undefined;
  const now = new Date().toISOString();
  const updated = { ...state.employees[index], ...updates, updatedAt: now };
  const newEmployees = [...state.employees];
  newEmployees[index] = updated;
  const newState = { ...state, employees: newEmployees };
  setState(newState);
  addAuditLog("UPDATE", "Employee", id, `Updated employee ${updated.name} (${updated.employeeCode})`);
  return updated;
}

export function deleteEmployee(id: string): boolean {
  const state = getState();
  const employee = state.employees.find((e) => e.id === id);
  if (!employee) return false;
  const newState = { ...state, employees: state.employees.filter((e) => e.id !== id) };
  setState(newState);
  addAuditLog("DELETE", "Employee", id, `Deleted employee ${employee.name} (${employee.employeeCode})`);
  return true;
}

export function getClients(): Client[] {
  return getState().clients;
}

export function getClient(id: string): Client | undefined {
  return getState().clients.find((c) => c.id === id);
}

export function addClient(client: Omit<Client, "id" | "code" | "createdAt" | "updatedAt">): Client {
  const state = getState();
  const nextCode = `CLI-${String(state.clients.length + 1).padStart(3, "0")}`;
  const now = new Date().toISOString();
  const newClient: Client = { ...client, id: generateId("c"), code: nextCode, createdAt: now, updatedAt: now };
  const newState = { ...state, clients: [...state.clients, newClient] };
  setState(newState);
  addAuditLog("CREATE", "Client", newClient.id, `Created client ${newClient.name}`);
  return newClient;
}

export function updateClient(id: string, updates: Partial<Client>): Client | undefined {
  const state = getState();
  const index = state.clients.findIndex((c) => c.id === id);
  if (index === -1) return undefined;
  const now = new Date().toISOString();
  const updated = { ...state.clients[index], ...updates, updatedAt: now };
  const newClients = [...state.clients];
  newClients[index] = updated;
  const newState = { ...state, clients: newClients };
  setState(newState);
  addAuditLog("UPDATE", "Client", id, `Updated client ${updated.name}`);
  return updated;
}

export function deleteClient(id: string): boolean {
  const state = getState();
  const client = state.clients.find((c) => c.id === id);
  if (!client) return false;
  const newState = { ...state, clients: state.clients.filter((c) => c.id !== id) };
  setState(newState);
  addAuditLog("DELETE", "Client", id, `Deleted client ${client.name}`);
  return true;
}

export function getProjects(): Project[] {
  return getState().projects;
}

export function getProject(id: string): Project | undefined {
  return getState().projects.find((p) => p.id === id);
}

export function addProject(project: Omit<Project, "id" | "code" | "createdAt" | "updatedAt">): Project {
  const state = getState();
  const nextCode = `PRJ-${String(state.projects.length + 1).padStart(3, "0")}`;
  const now = new Date().toISOString();
  const newProject: Project = { ...project, id: generateId("p"), code: nextCode, createdAt: now, updatedAt: now };
  const newState = { ...state, projects: [...state.projects, newProject] };
  setState(newState);
  addAuditLog("CREATE", "Project", newProject.id, `Created project ${newProject.name}`);
  return newProject;
}

export function updateProject(id: string, updates: Partial<Project>): Project | undefined {
  const state = getState();
  const index = state.projects.findIndex((p) => p.id === id);
  if (index === -1) return undefined;
  const now = new Date().toISOString();
  const updated = { ...state.projects[index], ...updates, updatedAt: now };
  const newProjects = [...state.projects];
  newProjects[index] = updated;
  const newState = { ...state, projects: newProjects };
  setState(newState);
  addAuditLog("UPDATE", "Project", id, `Updated project ${updated.name}`);
  return updated;
}

export function deleteProject(id: string): boolean {
  const state = getState();
  const project = state.projects.find((p) => p.id === id);
  if (!project) return false;
  const newState = { ...state, projects: state.projects.filter((p) => p.id !== id) };
  setState(newState);
  addAuditLog("DELETE", "Project", id, `Deleted project ${project.name}`);
  return true;
}

export function getSites(): Site[] {
  return getState().sites;
}

export function getSitesByProject(projectId: string): Site[] {
  return getState().sites.filter((s) => s.projectId === projectId);
}

export function addSite(site: Omit<Site, "id" | "code" | "createdAt" | "updatedAt">): Site {
  const state = getState();
  const projectSites = state.sites.filter((s) => s.projectId === site.projectId);
  const nextCode = `SITE-${String(state.sites.length + 1).padStart(3, "0")}`;
  const now = new Date().toISOString();
  const newSite: Site = { ...site, id: generateId("s"), code: nextCode, createdAt: now, updatedAt: now };
  const newState = { ...state, sites: [...state.sites, newSite] };
  setState(newState);
  addAuditLog("CREATE", "Site", newSite.id, `Created site ${newSite.name} for project ${state.projects.find((p) => p.id === site.projectId)?.name}`);
  return newSite;
}

export function updateSite(id: string, updates: Partial<Site>): Site | undefined {
  const state = getState();
  const index = state.sites.findIndex((s) => s.id === id);
  if (index === -1) return undefined;
  const now = new Date().toISOString();
  const updated = { ...state.sites[index], ...updates, updatedAt: now };
  const newSites = [...state.sites];
  newSites[index] = updated;
  const newState = { ...state, sites: newSites };
  setState(newState);
  addAuditLog("UPDATE", "Site", id, `Updated site ${updated.name}`);
  return updated;
}

export function getAssignments(): Assignment[] {
  return getState().assignments;
}

export function getAssignmentsByEmployee(employeeId: string): Assignment[] {
  return getState().assignments.filter((a) => a.employeeId === employeeId);
}

export function getAssignment(id: string): Assignment | undefined {
  return getState().assignments.find((a) => a.id === id);
}

export function addAssignment(assignment: Omit<Assignment, "id" | "createdAt" | "updatedAt">): Assignment {
  const state = getState();
  const now = new Date().toISOString();
  const newAssignment: Assignment = { ...assignment, id: generateId("a"), createdAt: now, updatedAt: now };
  const newState = { ...state, assignments: [...state.assignments, newAssignment] };
  setState(newState);
  addAuditLog("CREATE", "Assignment", newAssignment.id, `Created assignment for employee ${state.employees.find((e) => e.id === assignment.employeeId)?.name}`);
  return newAssignment;
}

export function updateAssignment(id: string, updates: Partial<Assignment>): Assignment | undefined {
  const state = getState();
  const index = state.assignments.findIndex((a) => a.id === id);
  if (index === -1) return undefined;
  const now = new Date().toISOString();
  const updated = { ...state.assignments[index], ...updates, updatedAt: now };
  const newAssignments = [...state.assignments];
  newAssignments[index] = updated;
  const newState = { ...state, assignments: newAssignments };
  setState(newState);
  addAuditLog("UPDATE", "Assignment", id, `Updated assignment for employee ${state.employees.find((e) => e.id === updated.employeeId)?.name}`);
  return updated;
}

export function getDocuments(): EmployeeDocument[] {
  return getState().documents;
}

export function getDocumentsByEmployee(employeeId: string): EmployeeDocument[] {
  return getState().documents.filter((d) => d.employeeId === employeeId);
}

export function addDocument(document: Omit<EmployeeDocument, "id" | "uploadedAt" | "updatedAt">): EmployeeDocument {
  const state = getState();
  const now = new Date().toISOString();
  const newDocument: EmployeeDocument = { ...document, id: generateId("d"), uploadedAt: now, updatedAt: now };
  const newState = { ...state, documents: [...state.documents, newDocument] };
  setState(newState);
  addAuditLog("CREATE", "Document", newDocument.id, `Created document ${newDocument.name}`);
  return newDocument;
}

export function updateDocument(id: string, updates: Partial<EmployeeDocument>): EmployeeDocument | undefined {
  const state = getState();
  const index = state.documents.findIndex((d) => d.id === id);
  if (index === -1) return undefined;
  const now = new Date().toISOString();
  const updated = { ...state.documents[index], ...updates, updatedAt: now };
  const newDocuments = [...state.documents];
  newDocuments[index] = updated;
  const newState = { ...state, documents: newDocuments };
  setState(newState);
  addAuditLog("UPDATE", "Document", id, `Updated document ${updated.name}`);
  return updated;
}

export function deleteDocument(id: string): boolean {
  const state = getState();
  const document = state.documents.find((d) => d.id === id);
  if (!document) return false;
  const newState = { ...state, documents: state.documents.filter((d) => d.id !== id) };
  setState(newState);
  addAuditLog("DELETE", "Document", id, `Deleted document ${document.name}`);
  return true;
}

export function getAttendance(): Attendance[] {
  return getState().attendance;
}

export function getAttendanceByEmployee(employeeId: string): Attendance[] {
  return getState().attendance.filter((a) => a.employeeId === employeeId);
}

export function addAttendance(attendance: Omit<Attendance, "id" | "createdAt" | "updatedAt">): Attendance {
  const state = getState();
  const now = new Date().toISOString();
  const newAttendance: Attendance = { ...attendance, id: generateId("att"), createdAt: now, updatedAt: now };
  const newState = { ...state, attendance: [...state.attendance, newAttendance] };
  setState(newState);
  addAuditLog("CREATE", "Attendance", newAttendance.id, `Created attendance record for employee ${state.employees.find((e) => e.id === attendance.employeeId)?.name}`);
  return newAttendance;
}

export function getPayroll(): PayrollEntry[] {
  return getState().payroll;
}

export function getPayrollByEmployee(employeeId: string): PayrollEntry[] {
  return getState().payroll.filter((p) => p.employeeId === employeeId);
}

export function addPayroll(payroll: Omit<PayrollEntry, "id" | "createdAt" | "updatedAt">): PayrollEntry {
  const state = getState();
  const now = new Date().toISOString();
  const newPayroll: PayrollEntry = { ...payroll, id: generateId("pay"), createdAt: now, updatedAt: now };
  const newState = { ...state, payroll: [...state.payroll, newPayroll] };
  setState(newState);
  addAuditLog("CREATE", "Payroll", newPayroll.id, `Created payroll entry for employee ${state.employees.find((e) => e.id === payroll.employeeId)?.name}`);
  return newPayroll;
}

export function getApprovals(): Approval[] {
  return getState().approvals;
}

export function getApproval(id: string): Approval | undefined {
  return getState().approvals.find((a) => a.id === id);
}

export function addApproval(approval: Omit<Approval, "id" | "createdAt" | "updatedAt">): Approval {
  const state = getState();
  const now = new Date().toISOString();
  const newApproval: Approval = { ...approval, id: generateId("ap"), createdAt: now, updatedAt: now };
  const newState = { ...state, approvals: [...state.approvals, newApproval] };
  setState(newState);
  addAuditLog("CREATE", "Approval", newApproval.id, `Created approval request ${newApproval.title}`);
  return newApproval;
}

export function updateApproval(id: string, updates: Partial<Approval>): Approval | undefined {
  const state = getState();
  const index = state.approvals.findIndex((a) => a.id === id);
  if (index === -1) return undefined;
  const now = new Date().toISOString();
  const updated = { ...state.approvals[index], ...updates, updatedAt: now };
  const newApprovals = [...state.approvals];
  newApprovals[index] = updated;
  const newState = { ...state, approvals: newApprovals };
  setState(newState);
  addAuditLog("UPDATE", "Approval", id, `Updated approval request ${updated.title}`);
  return updated;
}

export function getAuditLogs(): AuditLog[] {
  return getState().auditLogs;
}

export function addAuditLog(action: string, entityType: string, entityId: string, details: string): AuditLog {
  const state = getState();
  const user = state.currentUser || defaultUsers[0];
  const now = new Date().toISOString();
  const newLog: AuditLog = {
    id: generateId("al"),
    action,
    entityType,
    entityId,
    userId: user.id,
    userName: user.name,
    timestamp: now,
    details,
  };
  const newState = { ...state, auditLogs: [newLog, ...state.auditLogs] };
  setState(newState);
  return newLog;
}

export function getUsers(): User[] {
  return getState().users;
}

export function getCurrentUser(): User {
  return getState().currentUser || defaultUsers[0];
}

export function getBranches(): AppBranch[] {
  return getState().branches;
}

export function getCurrentBranch(): string {
  return getState().currentBranch;
}

export function setCurrentBranch(branchId: string) {
  const state = getState();
  setState({ ...state, currentBranch: branchId });
}

export function resetState() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function exportState(): string {
  return JSON.stringify(getState(), null, 2);
}

export function importState(json: string) {
  const parsed = JSON.parse(json) as AppState;
  setState({ ...initialState, ...parsed });
}
