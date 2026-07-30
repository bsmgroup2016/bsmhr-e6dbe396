import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Pencil,
  Trash2,
  Eye,
  Users,
  AlertTriangle,
  Clock,
  HardHat,
} from "lucide-react";
import { ArrowRight, ChevronLeft, ChevronRight, Mail, Phone } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { R2Image } from "@/components/r2-image";
import { EmployeeForm, employeeFromForm, WORKER_CATEGORIES, DEPLOYMENT_STATUSES } from "@/components/employee-form";
import { ExportButton, ImportDialog } from "@/components/data-io";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { getEmployees, addEmployee, updateEmployee, deleteEmployee, getCurrentCompany, getCompanies } from "@/lib/store";
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
  { key: "employeeCode", label: "Employee ID", example: "BS12" },
  { key: "name", label: "Name", required: true, example: "Rahman Md" },
  { key: "fin", label: "FIN", example: "G1234567X" },
  { key: "passportNumber", label: "Passport Number", example: "BX0912345" },
  { key: "nationality", label: "Nationality", example: "Bangladesh" },
  { key: "passType", label: "Pass Type", example: "Work Permit" },
  { key: "passExpiry", label: "Pass Expiry", example: "2027-05-31" },
  { key: "workPermitNumber", label: "Work Permit Number", example: "0-1234567" },
  { key: "branch", label: "Branch", example: "BSM Engineering" },
  { key: "trade", label: "Trade", example: "Welder" },
  { key: "status", label: "Status", example: "Active" },
  { key: "basicSalary", label: "Basic Salary", example: "1400" },
  { key: "joinedOn", label: "Joined On", example: "2025-01-15" },
  { key: "site", label: "Site", example: "Tuas Yard" },
  { key: "phone", label: "Phone", example: "+65 8123 4567" },
  { key: "email", label: "Email", example: "worker@bsm.sg" },
  { key: "levyRate", label: "Levy Rate", example: "300" },
  { key: "dormitory", label: "Dormitory", example: "Kranji Dorm B" },
];

function toEmployeeRow(employee: Employee) {
  return {
    "Employee Code": employee.employeeCode,
    Name: employee.name,
    FIN: employee.fin,
    Nationality: employee.nationality,
    "Pass Type": employee.passType,
    "Pass Expiry": employee.passExpiry,
    "Days To Expiry": daysUntil(employee.passExpiry) ?? "",
    Trade: employee.trade,
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
  const companyId = getCurrentCompany();
  const [allEmployees, setEmployees] = useState<Employee[]>(getEmployees());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | "all">("all");
  const [passFilter, setPassFilter] = useState<PassType | "all">("all");
  const [siteFilter, setSiteFilter] = useState<string | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<WorkerCategory | "all">("all");
  const [deployFilter, setDeployFilter] = useState<DeploymentStatus | "all">("all");
  const [nationalityFilter, setNationalityFilter] = useState<string>("all");
  const openCreateFromUrl = Route.useSearch().new === true;
  const [isCreateOpen, setIsCreateOpen] = useState(openCreateFromUrl);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [perPage, setPerPage] = useState("10");
  const [page, setPage] = useState(1);
  // Draft filter values — only applied when the user presses GET.
  const [draftCompany, setDraftCompany] = useState<string>("all");
  const [draftTrade, setDraftTrade] = useState<string>("all");
  const [draftSite, setDraftSite] = useState<string>("all");
  const [draftStatus, setDraftStatus] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [tradeFilter, setTradeFilter] = useState<string>("all");
  const companies = getCompanies();

  const employees = companyId ? allEmployees.filter((e) => !e.companyId || e.companyId === companyId) : allEmployees;
  const sites = Array.from(new Set(employees.map((e) => e.site).filter(Boolean)));
  const nationalities = Array.from(new Set(employees.map((e) => e.nationality).filter(Boolean))).sort();
  const trades = Array.from(new Set(employees.map((e) => e.trade).filter(Boolean))).sort();

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    const matchesSearch =
      e.name.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q) ||
      e.fin.toLowerCase().includes(q) ||
      e.trade.toLowerCase().includes(q) ||
      (e.phone ?? "").toLowerCase().includes(q) ||
      (e.email ?? "").toLowerCase().includes(q) ||
      (e.passportNumber ?? "").toLowerCase().includes(q) ||
      (e.workPermitNumber ?? "").toLowerCase().includes(q);
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

  const pageSize = Number(perPage);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const allOnPageSelected =
    paged.length > 0 && paged.every((e) => selectedIds.includes(e.id));

  function applyFilters() {
    setCompanyFilter(draftCompany);
    setTradeFilter(draftTrade);
    setSiteFilter(draftSite as string);
    setStatusFilter(draftStatus as EmployeeStatus | "all");
    setPage(1);
  }

  function resetFilters() {
    setDraftCompany("all");
    setDraftTrade("all");
    setDraftSite("all");
    setDraftStatus("all");
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

  const activeCount = employees.filter((e) => e.status === "Active" || e.status === "Deployed").length;
  const deployedCount = employees.filter((e) => e.status === "Deployed").length;
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

      const payload = {
        name: get("name"),
        nationality: get("nationality"),
        fin,
        passType,
        passExpiry: normalizeDate(get("passExpiry")) || "-",
        trade: get("trade") || "General Worker",
        site: get("site") || null,
        status,
        basicSalary: salary || 0,
        joinedOn: normalizeDate(get("joinedOn")) || new Date().toISOString().slice(0, 10),
        phone: get("phone"),
        levyRate: Number(get("levyRate").replace(/[^0-9.-]/g, "")) || 0,
        dormitory: get("dormitory"),
        email: get("email") || undefined,
        branch: get("branch") || undefined,
        passportNumber: get("passportNumber") || undefined,
        workPermitNumber: get("workPermitNumber") || undefined,
      };

      const code = get("employeeCode").trim();
      // Employee ID is the primary identifier — match on it first, FIN second.
      const byCode = code
        ? existing.find((e) => (e.employeeCode ?? "").toLowerCase() === code.toLowerCase())
        : undefined;
      if (byCode) {
        updateEmployee(byCode.id, payload);
        updated += 1;
        imported += 1;
        return;
      }
      if (code) {
        addEmployee({ ...payload, employeeCode: code } as never);
        imported += 1;
        return;
      }

      const match = fin ? existing.find((e) => e.fin.toUpperCase() === fin) : undefined;
      if (match) {
        updateEmployee(match.id, payload);
        updated += 1;
      } else {
        addEmployee(payload);
      }
      imported += 1;
    });

    return { imported, errors };
  }

  function handleCreate(formData: FormData) {
    addEmployee({
      ...employeeFromForm(formData),
      site: null,
      companyId: getCurrentCompany() || undefined,
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
      <div className="mx-auto max-w-7xl space-y-6">
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
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Register new employee</DialogTitle>
                <DialogDescription>Enter worker details. A unique employee code will be generated automatically.</DialogDescription>
              </DialogHeader>
              <EmployeeForm onSubmit={handleCreate} />
            </DialogContent>
          </Dialog>
          <div className="mt-2 flex flex-wrap gap-2 sm:mt-0">
            <ImportDialog
              title="Import employees"
              description="Upload any Excel/CSV of workers, then map its columns to system fields. Rows with a matching Employee ID are updated; the rest get a new branch-prefixed ID."
              templateName="employees"
              columns={EMPLOYEE_IMPORT_COLUMNS}
              onImport={handleImport}
              onDone={refresh}
              mappable
              label="Upload Employee XLSX"
            />
            <ExportButton rows={filtered.map(toEmployeeRow)} baseName="employees" sheetName="Employees" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Total employees" value={employees.length.toString()} icon={<Users className="h-5 w-5" />} variant="primary" caption="All workers" />
          <SummaryCard title="Active / Deployed" value={activeCount.toString()} icon={<HardHat className="h-5 w-5" />} variant="success" caption="Available or deployed" />
          <SummaryCard title="Expiring passes" value={expiringCount.toString()} icon={<Clock className="h-5 w-5" />} variant="warning" caption="Within 60 days" />
          <SummaryCard title="Expired passes" value={expiredCount.toString()} icon={<AlertTriangle className="h-5 w-5" />} variant="destructive" caption="Immediate action" />
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
              variant={showFilters ? "default" : "secondary"}
              className="gap-1.5"
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter className="h-4 w-4" />
              Filter
            </Button>
          </div>

          {/* Filter panel */}
          {showFilters ? (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="grid gap-4 lg:grid-cols-5">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Company</Label>
                  <Select value={draftCompany} onValueChange={setDraftCompany}>
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
                  <Label className="text-xs font-semibold">Department / Trade</Label>
                  <Select value={draftTrade} onValueChange={setDraftTrade}>
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
                  <Select value={draftSite} onValueChange={setDraftSite}>
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
                  <Select value={draftStatus} onValueChange={setDraftStatus}>
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
                  <Button className="gap-1.5" onClick={applyFilters}>
                    <ArrowRight className="h-4 w-4" />
                    GET
                  </Button>
                  <Button variant="outline" onClick={resetFilters}>Reset</Button>
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
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <Select value={perPage} onValueChange={(v) => { setPerPage(v); setPage(1); }}>
                <SelectTrigger className="h-9 w-20"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["10", "25", "50", "100"].map((n) => (<SelectItem key={n} value={n}>{n}</SelectItem>))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">records per page</span>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="wf-search" className="text-sm text-muted-foreground">Search</Label>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="wf-search"
                  type="search"
                  placeholder="Name, code, FIN, trade…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="h-9 pl-9"
                />
              </div>
              <ExportButton rows={filtered.map(toEmployeeRow)} baseName="employees" sheetName="Employees" />
            </div>
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
                  <TableHead className="min-w-[220px]">Contact</TableHead>
                  <TableHead className="w-40">Status</TableHead>
                  <TableHead className="w-36 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
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
                              to="/workforce/$id"
                              params={{ id: e.id }}
                              className="block text-sm font-semibold text-primary hover:underline"
                            >
                              {e.name}
                            </Link>
                            <div>Staff Id: {e.employeeCode}</div>
                            <div>FIN: {e.fin || "—"}</div>
                            <div>Nationality: {e.nationality || "—"}</div>
                            <div>Salary: S${e.basicSalary.toLocaleString()}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5 text-xs text-muted-foreground">
                          <div className="text-sm font-semibold text-foreground">
                            {companies.find((c) => c.id === e.companyId)?.name ?? e.branch ?? "—"}
                          </div>
                          <div>Department : {e.trade || "—"}</div>
                          <div>Designation : {e.workerCategory ?? e.passType}</div>
                          <div>Site : {e.site || "Unassigned"}</div>
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
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
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
        <DetailItem label="Basic salary" value={`S$${employee.basicSalary.toLocaleString()}`} />
        <DetailItem label="Levy rate" value={employee.levyRate ? `S$${employee.levyRate}` : "—"} />
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
          <Link to="/workforce/$id" params={{ id: employee.id }}>Open full profile</Link>
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
