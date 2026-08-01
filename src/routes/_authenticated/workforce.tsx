import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { activeAssignedEmployeeIds, isEmployeeAvailable } from "@/lib/availability";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  Users,
  AlertTriangle,
  Clock,
  HardHat,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { ChevronLeft, ChevronRight, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

import { AppShell } from "@/components/app-shell";
import { R2Image } from "@/components/r2-image";
import { EmployeeForm, employeeFromForm, WORKER_CATEGORIES, DEPLOYMENT_STATUSES } from "@/components/employee-form";
import { ExportButton, ImportDialog } from "@/components/data-io";
import { PFileDownloadButton } from "@/components/p-file-download-button";
import { PFileBulkDownloadButton } from "@/components/p-file-bulk-download-button";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { isCountableWorker } from "@/lib/workforce-split";
import { getEmployees, addEmployee, updateEmployee, deleteEmployee, getCurrentCompany, getCompanies, getProjects, getAssignments, getClients, getSites, addAssignment } from "@/lib/store";
import { employeeSlugById } from "@/lib/employee-slug";
import type { Employee, PassType, EmployeeStatus, DeploymentStatus, WorkerCategory } from "@/lib/types";
import { pick, type ImportColumn } from "@/lib/xlsx";

const passTypes: PassType[] = ["Work Permit", "S Pass", "Employment Pass", "Singaporean/PR"];
const statuses: EmployeeStatus[] = [
  "Draft", "Pending Approval", "Pending Profile Completion", "Pending Verification",
  "Active", "Inactive", "On Leave", "Deployed",
  "Suspended", "Resigned", "Terminated", "Repatriated", "Archived",
];

export const Route = createFileRoute("/_authenticated/workforce")({
  validateSearch: (search: Record<string, unknown>) => ({
    new: search.new === "1" || search.new === true ? true : undefined,
    available: search.available === "1" || search.available === true ? true : undefined,
    deployed: search.deployed === "1" || search.deployed === true ? true : undefined,
    company: typeof search.company === "string" ? search.company : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Workforce — BSM Workforce & Operations" },
      { name: "description", content: "Manage BSM Engineering employees and worker records." },
      { property: "og:title", content: "Workforce — BSM Workforce & Operations" },
      { property: "og:description", content: "Manage BSM Engineering employees and worker records." },
    ],
  }),
  component: WorkforcePage,
});

function daysUntil(iso: string): number | null {
  if (!iso || iso === "-") return null;
  const today = new Date("2026-07-28T00:00:00+08:00");
  const target = new Date(`${iso}T00:00:00+08:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function expiryBadge(passExpiry: string) {
  const days = daysUntil(passExpiry);
  if (days === null) return null;
  if (days < 0) return <StatusBadge variant="destructive" label="Expired" dot />;
  if (days <= 60) return <StatusBadge variant="warning" label={`${days}d left`} dot />;
  return <StatusBadge variant="success" label={`${days}d left`} dot />;
}

const EMPLOYEE_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "employeeCode", label: "P-File Number", example: "BS-12" },
  { key: "name", label: "Name", required: true, example: "Rahman Md" },
  { key: "fin", label: "FIN", example: "G1234567X" },
  { key: "passportNumber", label: "Passport Number", example: "BX0912345" },
  { key: "passportExpiry", label: "Passport Expiry", example: "2030-04-12" },
  { key: "nationality", label: "Nationality", example: "Bangladesh" },
  { key: "dateOfBirth", label: "Date Of Birth", example: "1995-03-08" },
  { key: "gender", label: "Gender", example: "Male" },
  { key: "maritalStatus", label: "Marital Status", example: "Single" },
  { key: "passType", label: "Pass Type", example: "Work Permit" },
  { key: "passExpiry", label: "Pass Expiry", example: "2027-05-31" },
  { key: "workPermitNumber", label: "Work Permit Number", example: "0-1234567" },
  { key: "workPermitExpiry", label: "Work Permit Expiry", example: "2027-05-31" },
  { key: "branch", label: "Branch", example: "BSM Engineering" },
  { key: "department", label: "Department", example: "Construction" },
  { key: "trade", label: "Designation", example: "Welder" },
  { key: "workerCategory", label: "Worker Category", example: "Skilled" },
  { key: "employmentType", label: "Employment Type", example: "Full-Time" },
  { key: "status", label: "Status", example: "Active" },
  { key: "basicSalary", label: "Basic Rate / Salary", example: "18" },
  { key: "otRate", label: "OT Rate", example: "27" },
  { key: "normalHours", label: "Normal Hours", example: "8" },
  { key: "declaredSalary", label: "Declared Salary", example: "1400" },
  { key: "joinedOn", label: "Joined On", example: "2025-01-15" },
  { key: "contractStart", label: "Contract Start", example: "2025-01-15" },
  { key: "contractEnd", label: "Contract End", example: "2027-01-14" },
  { key: "site", label: "Site", example: "Tuas Yard" },
  { key: "projectName", label: "Project Name", example: "Tuas Mega Port Package 2" },
  { key: "clientName", label: "Client Name", example: "Sembcorp Marine" },
  { key: "phone", label: "Phone", example: "+65 8123 4567" },
  { key: "altPhone", label: "Alt Phone", example: "+880 1712 345678" },
  { key: "email", label: "Email", example: "worker@bsm.sg" },
  { key: "address", label: "Address", example: "12 Kranji Road, Singapore" },
  { key: "postalCode", label: "Postal Code", example: "739566" },
  { key: "emergencyContact", label: "Emergency Contact", example: "Abdul Karim" },
  { key: "emergencyPhone", label: "Emergency Phone", example: "+880 1811 223344" },
  { key: "emergencyRelation", label: "Emergency Relation", example: "Brother" },
  { key: "bankName", label: "Bank Name", example: "DBS" },
  { key: "bankAccount", label: "Bank Account", example: "0123456789" },
  { key: "paymentMethod", label: "Payment Method", example: "Bank Transfer" },
  { key: "levyRate", label: "Levy Rate", example: "300" },
  { key: "dormitory", label: "Dormitory", example: "Kranji Dorm B" },
  { key: "skillLevel", label: "Skill Level", example: "Higher Skilled" },
  { key: "skillCertType", label: "Skill Cert Type", example: "SEC(K)" },
  { key: "skillCertNo", label: "Skill Cert No", example: "SEC-88213" },
  { key: "skillCertExpiry", label: "Skill Cert Expiry", example: "2028-06-30" },
  { key: "safetyCourseType", label: "SCOS / CSOC Type", example: "CSOC" },
  { key: "safetyCourseNo", label: "SCOS / CSOC No", example: "CSOC-7781" },
  { key: "safetyCourseExpiry", label: "SCOS / CSOC Expiry", example: "2028-03-15" },
  { key: "remarks", label: "Remarks", example: "Rejoined worker" },
];

/** Ready-to-fill demo rows shipped with the import dialog. */
const EMPLOYEE_DEMO_ROWS: Record<string, string>[] = [
  {
    employeeCode: "BS-201", name: "Rahman Md Shahin", fin: "G1234567X",
    passportNumber: "BX0912345", passportExpiry: "2030-04-12", nationality: "Bangladesh",
    dateOfBirth: "1995-03-08", gender: "Male", maritalStatus: "Single",
    passType: "Work Permit", passExpiry: "2027-05-31", workPermitNumber: "0-1234567",
    workPermitExpiry: "2027-05-31",
    branch: "BSM Engineering", department: "Construction", trade: "Welder",
    workerCategory: "Skilled", employmentType: "Full-Time", status: "Active",
    basicSalary: "22", otRate: "33", normalHours: "8", declaredSalary: "1600",
    joinedOn: "2025-01-15", contractStart: "2025-01-15", contractEnd: "2027-01-14",
    site: "Tuas Yard", projectName: "Tuas Mega Port Package 2", clientName: "Sembcorp Marine",
    phone: "+65 8123 4567", altPhone: "+880 1712 345678",
    email: "shahin@bsm.sg", address: "12 Kranji Road, Singapore", postalCode: "739566",
    emergencyContact: "Abdul Karim", emergencyPhone: "+880 1811 223344",
    emergencyRelation: "Brother", bankName: "DBS", bankAccount: "0123456789",
    paymentMethod: "Bank Transfer", levyRate: "300", dormitory: "Kranji Dorm B",
    skillLevel: "Higher Skilled", skillCertType: "Skills Evaluation (SEC(K))",
    skillCertNo: "SEC-88213", skillCertExpiry: "2028-06-30",
    safetyCourseType: "CSOC", safetyCourseNo: "CSOC-7781", safetyCourseExpiry: "2028-03-15",
    remarks: "",
  },
  {
    employeeCode: "V-045", name: "Kumar Suresh", fin: "G7654321M",
    passportNumber: "N2345678", passportExpiry: "2029-11-02", nationality: "India",
    dateOfBirth: "1990-07-21", gender: "Male", maritalStatus: "Married",
    passType: "S Pass", passExpiry: "2028-02-28", workPermitNumber: "",
    workPermitExpiry: "",
    branch: "VRL Engineering", department: "Construction", trade: "Site Supervisor",
    workerCategory: "Supervisor", employmentType: "Full-Time", status: "Active",
    basicSalary: "26", otRate: "39", normalHours: "8", declaredSalary: "3300",
    joinedOn: "2024-06-01", contractStart: "2024-06-01", contractEnd: "2026-05-31",
    site: "Jurong Site", projectName: "Jurong Island Turnaround", clientName: "Shell Singapore",
    phone: "+65 8234 5678", altPhone: "",
    email: "suresh@vrl.sg", address: "45 Jurong West St 41, Singapore", postalCode: "649412",
    emergencyContact: "Lakshmi Kumar", emergencyPhone: "+91 98400 11223",
    emergencyRelation: "Wife", bankName: "OCBC", bankAccount: "5566778899",
    paymentMethod: "GIRO", levyRate: "650", dormitory: "Jurong Dorm A",
    skillLevel: "Higher Skilled", skillCertType: "Multi-Skilling (MSC)",
    skillCertNo: "MSC-40219", skillCertExpiry: "2027-12-31",
    safetyCourseType: "SOC (Supervisor)", safetyCourseNo: "SOC-3312",
    safetyCourseExpiry: "2027-08-20", remarks: "Lifting supervisor certified",
  },
  {
    employeeCode: "P-018", name: "Ali Hossain", fin: "G2233445K",
    passportNumber: "BW7788990", passportExpiry: "2031-01-19", nationality: "Bangladesh",
    dateOfBirth: "1998-12-05", gender: "Male", maritalStatus: "Single",
    passType: "Work Permit", passExpiry: "2027-09-15", workPermitNumber: "0-7654321",
    workPermitExpiry: "2027-09-15",
    branch: "Pluto Engineering", department: "Construction", trade: "General Worker",
    workerCategory: "General Worker", employmentType: "Full-Time", status: "Active",
    basicSalary: "18", otRate: "27", normalHours: "8", declaredSalary: "1200",
    joinedOn: "2026-02-10", contractStart: "2026-02-10", contractEnd: "2028-02-09",
    site: "", projectName: "Sungei Kadut Workshop Upgrade", clientName: "JTC Corporation",
    phone: "+65 8345 6789", altPhone: "",
    email: "", address: "8 Sungei Kadut Loop, Singapore", postalCode: "729509",
    emergencyContact: "Jamila Begum", emergencyPhone: "+880 1911 556677",
    emergencyRelation: "Mother", bankName: "UOB", bankAccount: "3344556677",
    paymentMethod: "Bank Transfer", levyRate: "300", dormitory: "Sungei Kadut Dorm",
    skillLevel: "Basic Skilled", skillCertType: "", skillCertNo: "", skillCertExpiry: "",
    safetyCourseType: "CSOC", safetyCourseNo: "CSOC-9014", safetyCourseExpiry: "2029-01-31",
    remarks: "New joiner",
  },
];

function toEmployeeRow(employee: Employee) {
  return {
    "P-File Number": employee.employeeCode,
    Name: employee.name,
    FIN: employee.fin,
    Nationality: employee.nationality,
    "Pass Type": employee.passType,
    "Pass Expiry": employee.passExpiry,
    "Days To Expiry": daysUntil(employee.passExpiry) ?? "",
    Designation: employee.trade,
    Site: employee.site ?? "",
    Status: employee.status,
    "Basic Salary": employee.basicSalary,
    "Levy Rate": employee.levyRate ?? 0,
    "Joined On": employee.joinedOn,
    Phone: employee.phone ?? "",
    Email: employee.email ?? "",
    Dormitory: employee.dormitory ?? "",
  };
}

function normalizeDate(value: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

export default function WorkforcePage() {
  const [allEmployees, setEmployees] = useState<Employee[]>(getEmployees());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | "all">("all");
  const [passFilter, setPassFilter] = useState<PassType | "all">("all");
  const [siteFilter, setSiteFilter] = useState<string | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<WorkerCategory | "all">("all");
  const [deployFilter, setDeployFilter] = useState<DeploymentStatus | "all">("all");
  const [nationalityFilter, setNationalityFilter] = useState<string>("all");
  const routeSearch = Route.useSearch();
  const openCreateFromUrl = routeSearch.new === true;
  const [isCreateOpen, setIsCreateOpen] = useState(openCreateFromUrl);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [perPage, setPerPage] = useState("10");
  const [page, setPage] = useState(1);
  const [companyFilter, setCompanyFilter] = useState<string>(routeSearch.company ?? "all");
  const [tradeFilter, setTradeFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const activeFilterCount = [
    companyFilter,
    tradeFilter,
    siteFilter,
    statusFilter,
    passFilter,
    categoryFilter,
    deployFilter,
    nationalityFilter,
  ].filter((v) => v !== "all").length;
  const companies = getCompanies();
  const projects = getProjects();
  const assignments = getAssignments();
  const assignedIds = activeAssignedEmployeeIds(assignments);
  const employeeProjectMap = useMemo(() => {
    const map = new Map<string, string>();
    const active = assignments.filter((a) => a.status === "Active" || a.status === "Approved");
    for (const a of active) {
      const p = projects.find((proj) => proj.id === a.projectId);
      if (p) map.set(a.employeeId, p.name);
    }
    return map;
  }, [assignments, projects]);
  function isAvailable(e: Employee) {
    return isEmployeeAvailable(e, assignedIds);
  }

  // Only real employees: records must belong to a company (admin/staff accounts
  // without a company are excluded from this page).
  const employees = allEmployees.filter(isCountableWorker);
  const sites = Array.from(new Set(employees.map((e) => e.site).filter(Boolean)));
  const nationalities = Array.from(new Set(employees.map((e) => e.nationality).filter(Boolean))).sort();
  const trades = Array.from(new Set(employees.map((e) => e.trade).filter(Boolean))).sort();

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    const assignedProject = employeeProjectMap.get(e.id) ?? "";
    const matchesSearch =
      e.name.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().replace(/[^a-z0-9]/g, "").includes(q.replace(/[^a-z0-9]/g, "")) ||
      e.fin.toLowerCase().includes(q) ||
      e.trade.toLowerCase().includes(q) ||
      (e.phone ?? "").toLowerCase().includes(q) ||
      (e.email ?? "").toLowerCase().includes(q) ||
      (e.passportNumber ?? "").toLowerCase().includes(q) ||
      (e.workPermitNumber ?? "").toLowerCase().includes(q) ||
      assignedProject.toLowerCase().includes(q);
    return (
      matchesSearch &&
      (statusFilter === "all" || e.status === statusFilter) &&
      (passFilter === "all" || e.passType === passFilter) &&
      (siteFilter === "all" || e.site === siteFilter) &&
      (categoryFilter === "all" || e.workerCategory === categoryFilter) &&
      (deployFilter === "all" || (e.deploymentStatus ?? "Available") === deployFilter) &&
      (nationalityFilter === "all" || e.nationality === nationalityFilter) &&
      (companyFilter === "all" || e.companyId === companyFilter) &&
      (tradeFilter === "all" || e.trade === tradeFilter)
    );
  });

  const availableCount = employees.filter(isAvailable).length;

  const pageSize = Number(perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const allOnPageSelected =
    paged.length > 0 && paged.every((e) => selectedIds.includes(e.id));

  function resetFilters() {
    setCompanyFilter("all");
    setTradeFilter("all");
    setSiteFilter("all");
    setStatusFilter("all");
    setPage(1);
  }

  function bulkDelete() {
    selectedIds.forEach((id) => deleteEmployee(id));
    setSelectedIds([]);
    setBulkDeleteOpen(false);
    refresh();
  }

  const expiringCount = employees.filter((e) => {
    const days = daysUntil(e.passExpiry);
    return days !== null && days <= 60 && days >= 0;
  }).length;
  const expiredCount = employees.filter((e) => {
    const days = daysUntil(e.passExpiry);
    return days !== null && days < 0;
  }).length;

  function refresh() {
    setEmployees(getEmployees());
  }

  const pendingProfiles = employees.filter(
    (e) => e.status === "Pending Verification" || e.status === "Pending Profile Completion",
  );

  function verifyProfile(id: string) {
    updateEmployee(id, { status: "Active" });
    refresh();
  }

  function handleImport(rows: Record<string, string>[]) {
    const errors: string[] = [];
    let imported = 0;
    let updated = 0;
    const existing = getEmployees();
    const allProjects = getProjects();
    const allClients = getClients();
    const allSites = getSites();
    const allAssignments = getAssignments();
    const linkProject = (employeeId: string, projectName: string, clientName: string, start: string) => {
      const lcP = projectName.trim().toLowerCase();
      const lcC = clientName.trim().toLowerCase();
      const client = lcC ? allClients.find((c) => c.name.toLowerCase() === lcC) : undefined;
      const project =
        (lcP ? allProjects.find((p) => p.name.toLowerCase() === lcP || (p.code ?? "").toLowerCase() === lcP) : undefined) ??
        (client ? allProjects.find((p) => p.clientId === client.id) : undefined);
      if (!project) return;
      const active = allAssignments.some(
        (a) => a.employeeId === employeeId && a.projectId === project.id && (a.status === "Active" || a.status === "Approved"),
      );
      if (active) return;
      addAssignment({
        employeeId,
        projectId: project.id,
        siteId: allSites.find((s) => s.projectId === project.id)?.id ?? "",
        startDate: start,
        status: "Active",
      });
    };

    rows.forEach((row, index) => {
      const get = (key: string) => {
        const column = EMPLOYEE_IMPORT_COLUMNS.find((c) => c.key === key)!;
        return pick(row, column);
      };
      const fin = get("fin").toUpperCase();
      const passType = (passTypes.find((p) => p.toLowerCase() === get("passType").toLowerCase()) ??
        "Work Permit") as PassType;
      const status = (statuses.find((s) => s.toLowerCase() === get("status").toLowerCase()) ??
        "Active") as EmployeeStatus;
      const salary = Number(get("basicSalary").replace(/[^0-9.-]/g, ""));

      if (Number.isNaN(salary)) {
        errors.push(`Row ${index + 2}: invalid basic salary`);
        return;
      }

      const joined = normalizeDate(get("joinedOn")) || new Date().toISOString().slice(0, 10);
      const passExpiry =
        normalizeDate(get("passExpiry")) || normalizeDate(get("workPermitExpiry")) || "-";
      const payload = {
        name: get("name"),
        nationality: get("nationality"),
        fin,
        passType,
        passExpiry,
        trade: get("trade") || "General Worker",
        site: get("site") || null,
        status,
        basicSalary: salary || 0,
        joinedOn: joined,
        phone: get("phone"),
        levyRate: Number(get("levyRate").replace(/[^0-9.-]/g, "")) || 0,
        dormitory: get("dormitory"),
        email: get("email") || undefined,
        branch: get("branch") || undefined,
        passportNumber: get("passportNumber") || undefined,
        workPermitNumber: get("workPermitNumber") || undefined,
        passportExpiry: normalizeDate(get("passportExpiry")) || undefined,
        dateOfBirth: normalizeDate(get("dateOfBirth")) || undefined,
        gender: (get("gender") || undefined) as Employee["gender"],
        maritalStatus: (get("maritalStatus") || undefined) as Employee["maritalStatus"],
        department: get("department") || undefined,
        workerCategory: (get("workerCategory") || undefined) as Employee["workerCategory"],
        employmentType: (get("employmentType") || undefined) as Employee["employmentType"],
        otRate: Number(get("otRate").replace(/[^0-9.-]/g, "")) || undefined,
        normalHours: Number(get("normalHours").replace(/[^0-9.-]/g, "")) || undefined,
        declaredSalary: Number(get("declaredSalary").replace(/[^0-9.-]/g, "")) || undefined,
        contractStart: normalizeDate(get("contractStart")) || undefined,
        contractEnd: normalizeDate(get("contractEnd")) || undefined,
        altPhone: get("altPhone") || undefined,
        address: get("address") || undefined,
        postalCode: get("postalCode") || undefined,
        emergencyContact: get("emergencyContact") || undefined,
        emergencyPhone: get("emergencyPhone") || undefined,
        emergencyRelation: get("emergencyRelation") || undefined,
        bankName: get("bankName") || undefined,
        bankAccount: get("bankAccount") || undefined,
        paymentMethod: (get("paymentMethod") || undefined) as Employee["paymentMethod"],
        skillLevel: (get("skillLevel") || undefined) as Employee["skillLevel"],
        skillCertType: (get("skillCertType") || undefined) as Employee["skillCertType"],
        skillCertNo: get("skillCertNo") || undefined,
        skillCertExpiry: normalizeDate(get("skillCertExpiry")) || undefined,
        safetyCourseType: get("safetyCourseType") || undefined,
        safetyCourseNo: get("safetyCourseNo") || undefined,
        safetyCourseExpiry: normalizeDate(get("safetyCourseExpiry")) || undefined,
        remarks: get("remarks") || undefined,
        companyId:
          (companyFilter !== "all" ? companyFilter : undefined) ??
          getCurrentCompany() ??
          companies[0]?.id,
      };

      const code = get("employeeCode").trim();
      // Employee ID is the primary identifier — match on it first, FIN second.
      const byCode = code
        ? existing.find((e) => (e.employeeCode ?? "").toLowerCase() === code.toLowerCase())
        : undefined;
      if (byCode) {
        updateEmployee(byCode.id, payload);
        linkProject(byCode.id, get("projectName"), get("clientName"), joined);
        updated += 1;
        imported += 1;
        return;
      }
      if (code) {
        const created = addEmployee({ ...payload, employeeCode: code } as never);
        if (created) linkProject(created.id, get("projectName"), get("clientName"), joined);
        imported += 1;
        return;
      }

      const match = fin ? existing.find((e) => e.fin.toUpperCase() === fin) : undefined;
      if (match) {
        updateEmployee(match.id, payload);
        linkProject(match.id, get("projectName"), get("clientName"), joined);
        updated += 1;
      } else {
        const created = addEmployee(payload);
        if (created) linkProject(created.id, get("projectName"), get("clientName"), joined);
      }
      imported += 1;
    });

    return { imported, errors };
  }

  function handleCreate(formData: FormData) {
    addEmployee({
      ...employeeFromForm(formData),
      site: null,
      companyId:
        (companyFilter !== "all" ? companyFilter : undefined) ??
        getCurrentCompany() ??
        companies[0]?.id,
    } as Omit<Employee, "id" | "employeeCode" | "createdAt" | "updatedAt">);
    setIsCreateOpen(false);
    refresh();
  }

  function handleEdit(formData: FormData) {
    if (!editingEmployee) return;
    updateEmployee(editingEmployee.id, employeeFromForm(formData));
    setEditingEmployee(null);
    refresh();
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteEmployee(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Workforce</h1>
            <p className="text-sm text-muted-foreground">Employee directory and worker management.</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="mt-2 sm:mt-0">
                <Plus className="mr-1 h-4 w-4" />
                Register employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Register new employee</DialogTitle>
                <DialogDescription>Enter worker details. A unique P-File number will be generated automatically.</DialogDescription>
              </DialogHeader>
              <EmployeeForm onSubmit={handleCreate} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Total employees" value={employees.length.toString()} icon={<Users className="h-5 w-5" />} variant="primary" caption="All workers" compact />
          <Link to="/available-workers" className="block h-full">
            <SummaryCard title="Available workers" value={availableCount.toString()} icon={<HardHat className="h-5 w-5" />} variant="success" caption="Not assigned to any project" compact />
          </Link>
          <SummaryCard title="Expiring passes" value={expiringCount.toString()} icon={<Clock className="h-5 w-5" />} variant="warning" caption="Within 60 days" compact />
          <SummaryCard title="Expired passes" value={expiredCount.toString()} icon={<AlertTriangle className="h-5 w-5" />} variant="destructive" caption="Immediate action" compact />
        </div>

        {pendingProfiles.length > 0 ? (
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Self-signup profiles to review</h2>
                <p className="text-xs text-muted-foreground">
                  Accounts created by workers themselves. Check the details, then verify to activate.
                </p>
              </div>
              <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-600">
                {pendingProfiles.length} pending
              </span>
            </div>
            <div className="space-y-2">
              {pendingProfiles.map((e) => (
                <div
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/60 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {e.name} · {e.employeeCode}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.email ?? "no email"} · {e.phone ?? "no phone"} · {e.status}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setViewingEmployee(e)}>
                      Open
                    </Button>
                    <Button
                      size="sm"
                      disabled={e.status === "Pending Profile Completion"}
                      onClick={() => verifyProfile(e.id)}
                    >
                      Verify & activate
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          {/* Action bar */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Add Employee
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-1.5"
                disabled={selectedIds.length === 0}
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Bulk delete{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                aria-expanded={showFilters}
                onClick={() => setShowFilters((v) => !v)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filter
                {activeFilterCount > 0 ? (
                  <span className="ml-1 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                    {activeFilterCount}
                  </span>
                ) : null}
                <ChevronDown className={cn("h-4 w-4 transition-transform", showFilters && "rotate-180")} />
              </Button>
              <Button
                size="sm"
                variant={availableOnly ? "default" : "outline"}
                className="gap-1.5"
                aria-pressed={availableOnly}
                onClick={() => {
                  if (availableOnly) {
                    showAllEmployees();
                    return;
                  }
                  setAvailableOnly(true);
                  setDeployedOnly(false);
                  setPage(1);
                }}
              >
                <UserCheck className="h-4 w-4" />
                {availableOnly ? "Hide available workers" : "Available workers"}
                <span
                  className={cn(
                    "ml-1 rounded-full px-1.5 text-[11px] font-semibold",
                    availableOnly
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {availableCount}
                </span>
              </Button>
              <Button
                size="sm"
                variant={deployedOnly ? "default" : "outline"}
                className="gap-1.5"
                aria-pressed={deployedOnly}
                onClick={() => {
                  if (deployedOnly) {
                    showAllEmployees();
                    return;
                  }
                  setDeployedOnly(true);
                  setAvailableOnly(false);
                  setPage(1);
                }}
              >
                <Briefcase className="h-4 w-4" />
                {deployedOnly ? "Hide deployed workers" : "Deployed workers"}
                <span
                  className={cn(
                    "ml-1 rounded-full px-1.5 text-[11px] font-semibold",
                    deployedOnly
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {deployedWorkerCount}
                </span>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ImportDialog
                title="Import employees"
                description="Upload any Excel/CSV of workers, then map its columns to system fields."
                templateName="employees"
                columns={EMPLOYEE_IMPORT_COLUMNS}
                onImport={handleImport}
                onDone={refresh}
                mappable
                demoRows={EMPLOYEE_DEMO_ROWS}
                label="Upload XLSX"
              />
              <ExportButton rows={filtered.map(toEmployeeRow)} baseName="employees" sheetName="Employees" />
              {availableOnly && (
                <PFileBulkDownloadButton
                  people={filtered}
                  zipBaseName="Available-Workers-P-Files"
                />
              )}
            </div>
          </div>

          {/* Filter panel */}
          {showFilters ? (
          <div className="rounded-lg border bg-muted/30 p-4 animate-in fade-in slide-in-from-top-2">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Company</Label>
                <Select value={companyFilter} onValueChange={(v) => { setCompanyFilter(v); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Select Company…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All companies</SelectItem>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Designation</Label>
                <Select value={tradeFilter} onValueChange={(v) => { setTradeFilter(v); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Select Department…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All trades</SelectItem>
                    {trades.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Site</Label>
                <Select value={siteFilter} onValueChange={(v) => { setSiteFilter(v); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Select Site…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All sites</SelectItem>
                    {sites.map((s) => (
                      <SelectItem key={s} value={s as string}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Status</Label>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as EmployeeStatus | "all"); setPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="Select Status…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All status</SelectItem>
                    {statuses.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button variant="outline" className="w-full" onClick={resetFilters}>Reset</Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
              <Select value={passFilter} onValueChange={(v) => setPassFilter(v as PassType | "all")}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Pass type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All passes</SelectItem>
                  {passTypes.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as WorkerCategory | "all")}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {WORKER_CATEGORIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={deployFilter} onValueChange={(v) => setDeployFilter(v as DeploymentStatus | "all")}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Deployment" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All deployment</SelectItem>
                  {DEPLOYMENT_STATUSES.map((d) => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                </SelectContent>
              </Select>
              <Select value={nationalityFilter} onValueChange={setNationalityFilter}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Nationality" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All nationalities</SelectItem>
                  {nationalities.map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          ) : null}

          {/* Records per page + search */}
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 lg:flex-row lg:items-center">
            {availableOnly || deployedOnly ? (
              <>
                <div className="flex flex-1 items-center gap-2 lg:justify-start">
                  <Select value={perPage} onValueChange={(v) => { setPerPage(v); setPage(1); }}>
                    <SelectTrigger className="h-9 w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["10", "25", "50", "100"].map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">records per page</span>
                </div>
                <div className="flex flex-1 items-center justify-center gap-2">
                  <Label htmlFor="wf-search" className="text-sm text-muted-foreground">Search</Label>
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="wf-search"
                      type="search"
                      placeholder="Name, P-File, FIN, project, designation…"
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      className="h-9 pl-9"
                    />
                  </div>
                </div>
                <div className="flex flex-1 items-center justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={showAllEmployees}>
                    {availableOnly ? "Hide available workers" : "Hide deployed workers"}
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={availableOnly ? "/available-workers" : "/deployed-workers"}>View details</Link>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Select value={perPage} onValueChange={(v) => { setPerPage(v); setPage(1); }}>
                    <SelectTrigger className="h-9 w-20"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["10", "25", "50", "100"].map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">records per page</span>
                </div>
                <div className="flex flex-1 items-center justify-end gap-2">
                  <Label htmlFor="wf-search" className="text-sm text-muted-foreground">Search</Label>
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="wf-search"
                      type="search"
                      placeholder="Name, P-File, FIN, project, designation…"
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                      className="h-9 pl-9"
                    />
                  </div>
                </div>
              </>
            )}
          </div>



          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allOnPageSelected}
                      aria-label="Select all employees on this page"
                      onCheckedChange={(v) =>
                        setSelectedIds(v === true ? paged.map((e) => e.id) : [])
                      }
                    />
                  </TableHead>
                  <TableHead className="min-w-[260px]">Employee</TableHead>
                  <TableHead className="min-w-[220px]">Company</TableHead>
                  <TableHead className="min-w-[180px]">Project</TableHead>
                  <TableHead className="min-w-[220px]">Contact</TableHead>
                  <TableHead className="w-40">Status</TableHead>
                  <TableHead className="w-36 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
                      <EmptyState
                        className="bg-transparent border-0"
                        icon={<Users className="h-5 w-5" />}
                        title="No employees found"
                        description="Try adjusting filters or register a new employee."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((e) => (
                    <TableRow key={e.id} className="align-top">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(e.id)}
                          aria-label={`Select ${e.name}`}
                          onCheckedChange={(v) =>
                            setSelectedIds((prev) =>
                              v === true ? [...prev, e.id] : prev.filter((x) => x !== e.id),
                            )
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-start gap-3">
                          <R2Image
                            src={e.photoUrl}
                            alt={e.name}
                            className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-border"
                            fallback={
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
                                {e.name.slice(0, 2).toUpperCase()}
                              </span>
                            }
                          />
                          <div className="space-y-0.5 text-xs text-muted-foreground">
                            <Link
                              to="/workforce/$slug"
                              params={{ slug: employeeSlugById(e.id) }}
                              className="block text-sm font-semibold text-primary hover:underline"
                            >
                              {e.name}
                            </Link>
                            <div>P-File No: {e.employeeCode}</div>
                            <div>FIN: {e.fin || "—"}</div>
                            <div>Basic Rate: ${e.basicSalary.toLocaleString()}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          <div className="text-sm font-semibold text-foreground">
                            {companies.find((c) => c.id === e.companyId)?.name ?? e.branch ?? "—"}
                          </div>
                          <div>Department : {e.department || "—"}</div>
                          <div>Designation : {e.trade || "—"}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-foreground">
                          {employeeProjectMap.get(e.id) ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{e.email || "—"}</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{e.phone || "—"}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1.5">
                          <StatusBadge
                            variant={
                              e.status === "Active" ? "success" : e.status === "Deployed" ? "info" : e.status === "On Leave" ? "warning" : "ghost"
                            }
                            label={e.status}
                            dot
                          />
                          {expiryBadge(e.passExpiry)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8"
                            aria-label={`Quick view ${e.name}`}
                            onClick={() => setViewingEmployee(e)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <PFileDownloadButton
                            pFileUrl={e.pFileUrl}
                            name={e.name}
                            code={e.employeeCode}
                          />
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 border-primary/30 text-primary hover:bg-primary/10"
                            aria-label={`Edit ${e.name}`}
                            onClick={() => setEditingEmployee(e)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 border-destructive/30 text-destructive hover:bg-destructive/10"
                            aria-label={`Delete ${e.name}`}
                            onClick={() => setDeleteTarget(e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t pt-3 sm:flex-row">
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} employees
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="h-4 w-4" />
                Prev
              </Button>
              <span className="text-xs text-muted-foreground">Page {currentPage} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete {selectedIds.length} employee(s)?</DialogTitle>
              <DialogDescription>
                The selected employee records will be permanently removed. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={bulkDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingEmployee} onOpenChange={(open) => !open && setEditingEmployee(null)}>
          <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Edit employee</DialogTitle>
              <DialogDescription>Update worker details for {editingEmployee?.employeeCode}.</DialogDescription>
            </DialogHeader>
            {editingEmployee && <EmployeeForm employee={editingEmployee} onSubmit={handleEdit} />}
          </DialogContent>
        </Dialog>

        <Sheet open={!!viewingEmployee} onOpenChange={(open) => !open && setViewingEmployee(null)}>
          <SheetContent className="sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{viewingEmployee?.name}</SheetTitle>
              <SheetDescription>
                {viewingEmployee?.employeeCode} • {viewingEmployee?.trade}
              </SheetDescription>
            </SheetHeader>
            {viewingEmployee && <EmployeeDetail employee={viewingEmployee} onEdit={() => { setViewingEmployee(null); setEditingEmployee(viewingEmployee); }} />}
          </SheetContent>
        </Sheet>

        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete employee?</DialogTitle>
              <DialogDescription>
                This will permanently remove {deleteTarget?.name} ({deleteTarget?.employeeCode}). This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

function EmployeeDetail({ employee, onEdit }: { employee: Employee; onEdit: () => void }) {
  const days = daysUntil(employee.passExpiry);
  return (
    <div className="mt-6 space-y-5">
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
          {employee.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-foreground">{employee.name}</h3>
          <p className="text-sm text-muted-foreground">{employee.employeeCode} • {employee.trade}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge
              variant={
                employee.status === "Active" ? "success" : employee.status === "Deployed" ? "info" : employee.status === "On Leave" ? "warning" : "ghost"
              }
              label={employee.status}
              dot
            />
            {expiryBadge(employee.passExpiry)}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <DetailItem label="Nationality" value={employee.nationality} />
        <DetailItem label="FIN / NRIC" value={employee.fin} />
        <DetailItem label="Pass type" value={employee.passType} />
        <DetailItem label="Pass expiry" value={employee.passExpiry} />
        <DetailItem label="Basic salary" value={`$${employee.basicSalary.toLocaleString()}`} />
        <DetailItem label="Levy rate" value={employee.levyRate ? `$${employee.levyRate}` : "—"} />
        <DetailItem label="Joined on" value={employee.joinedOn} />
        <DetailItem label="Site" value={employee.site || "Unassigned"} />
        <DetailItem label="Phone" value={employee.phone || "—"} />
        <DetailItem label="Email" value={employee.email || "—"} />
        <DetailItem label="Emergency contact" value={employee.emergencyContact || "—"} />
        <DetailItem label="Emergency phone" value={employee.emergencyPhone || "—"} />
      </div>

      <div className="space-y-2">
        <Label className="text-muted-foreground">Address</Label>
        <p className="text-sm text-foreground">{employee.address || "—"}</p>
      </div>

      <div className="space-y-2">
        <Label className="text-muted-foreground">Remarks</Label>
        <p className="text-sm text-foreground">{employee.remarks || "—"}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/workforce/$slug" params={{ slug: employeeSlugById(employee.id) }}>Open full profile</Link>
        </Button>
        <Button variant="outline" onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
        <Button variant="outline" asChild>
          <Link to="/documents" search={{ employee: employee.id }}>
            View documents
          </Link>
        </Button>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-muted-foreground">{label}</Label>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
