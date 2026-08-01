import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Briefcase, Building2, CalendarOff, IdCard, Pencil, Plane, Search, Trash2, Users, Wallet,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmployeeForm, employeeFromForm } from "@/components/employee-form";
import { PFileDownloadButton } from "@/components/p-file-download-button";
import type { Employee } from "@/lib/types";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  getEmployees,
  getCompanies,
  getLeaveRequests,
  updateEmployee,
  deleteEmployee,
} from "@/lib/store";
import { employeeSlugById } from "@/lib/employee-slug";
import { isOfficeStaff } from "@/lib/workforce-split";

function daysUntil(iso?: string | null): number | null {
  if (!iso || iso === "-") return null;
  const t = new Date(`${iso}T00:00:00+08:00`).getTime();
  if (Number.isNaN(t)) return null;
  return Math.round((t - Date.now()) / 86_400_000);
}

function ExpiryCell({ date }: { date?: string | null }) {
  const d = daysUntil(date);
  if (d === null) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className="text-sm tabular-nums">{date}</span>
      <StatusBadge
        variant={d < 0 ? "destructive" : d <= 60 ? "warning" : "success"}
        label={d < 0 ? "expired" : `${d}d`}
      />
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/staff-management")({
  head: () => ({
    meta: [
      { title: "Staff Management — BSM Workforce & Operations" },
      {
        name: "description",
        content: "Office and administrative staff by department, designation and company.",
      },
      { property: "og:title", content: "Staff Management — BSM Workforce & Operations" },
      {
        property: "og:description",
        content: "Office and administrative staff by department, designation and company.",
      },
    ],
  }),
  component: StaffManagementPage,
});

function StaffManagementPage() {
  const companies = getCompanies();
  const [allEmployees, setEmployees] = useState<Employee[]>(getEmployees());
  const [editingStaff, setEditingStaff] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const staff = allEmployees.filter(isOfficeStaff);

  function refresh() {
    setEmployees(getEmployees());
  }

  function handleEdit(formData: FormData) {
    if (!editingStaff) return;
    updateEmployee(editingStaff.id, employeeFromForm(formData));
    setEditingStaff(null);
    refresh();
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteEmployee(deleteTarget.id);
    setDeleteTarget(null);
    refresh();
  }
  const leave = getLeaveRequests();
  const today = new Date().toISOString().slice(0, 10);
  const staffIds = new Set(staff.map((e) => e.id));
  const onLeaveToday = leave.filter(
    (l) =>
      staffIds.has(l.employeeId) &&
      l.status === "Approved" &&
      l.startDate <= today &&
      l.endDate >= today,
  );
  const monthlyPayroll = staff.reduce((sum, e) => sum + (e.basicSalary || 0), 0);
  const passExpiring = staff.filter((e) => {
    const d = daysUntil(e.workPermitExpiryDate ?? e.passExpiry);
    return d !== null && d <= 60;
  }).length;
  const passportExpiring = staff.filter((e) => {
    const d = daysUntil(e.passportExpiry);
    return d !== null && d <= 60;
  }).length;

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("all");
  const [designation, setDesignation] = useState("all");
  const [company, setCompany] = useState("all");

  const departments = Array.from(
    new Set(staff.map((e) => e.department).filter(Boolean)),
  ).sort() as string[];
  const designations = Array.from(
    new Set(staff.map((e) => e.trade).filter(Boolean)),
  ).sort() as string[];

  const byDepartment = departments
    .map((d) => ({ department: d, count: staff.filter((e) => e.department === d).length }))
    .sort((a, b) => b.count - a.count);

  const q = search.toLowerCase();
  const rows = staff.filter(
    (e) =>
      (e.name.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        (e.passportNumber ?? "").toLowerCase().includes(q) ||
        (e.trade ?? "").toLowerCase().includes(q)) &&
      (department === "all" || e.department === department) &&
      (designation === "all" || e.trade === designation) &&
      (company === "all" || e.companyId === company),
  );

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Staff Management</h1>
            <p className="text-sm text-muted-foreground">
              Office and administrative staff — HR, Accounts, IT, Admin and QS. Staff use an
              Employee ID and a fixed monthly salary.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link to="/leave">
                <CalendarOff className="mr-1 h-4 w-4" /> Leave
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/payroll">
                <Wallet className="mr-1 h-4 w-4" /> Payslips
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/compliance">
                <Plane className="mr-1 h-4 w-4" /> Pass & passport
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Total staff"
            value={String(staff.length)}
            icon={<Briefcase className="h-5 w-5" />}
            variant="primary"
            caption="Office & admin"
            compact
          />
          <SummaryCard
            title="On leave today"
            value={String(onLeaveToday.length)}
            icon={<CalendarOff className="h-5 w-5" />}
            variant="warning"
            caption="Approved leave"
            compact
          />
          <SummaryCard
            title="Monthly salary bill"
            value={`$${monthlyPayroll.toLocaleString()}`}
            icon={<Wallet className="h-5 w-5" />}
            variant="success"
            caption="Fixed salaries"
            compact
          />
          <SummaryCard
            title="Work permit expiry"
            value={String(passExpiring)}
            icon={<IdCard className="h-5 w-5" />}
            variant={passExpiring ? "warning" : "info"}
            caption="Within 60 days"
            compact
          />
          <SummaryCard
            title="Passport expiry"
            value={String(passportExpiring)}
            icon={<Plane className="h-5 w-5" />}
            variant={passportExpiring ? "warning" : "info"}
            caption="Within 60 days"
            compact
          />
          <SummaryCard
            title="Departments"
            value={String(byDepartment.length)}
            icon={<Building2 className="h-5 w-5" />}
            variant="info"
            caption="With staff assigned"
            compact
          />
          <SummaryCard
            title="Designations"
            value={String(designations.length)}
            icon={<Users className="h-5 w-5" />}
            variant="success"
            caption="Distinct roles"
            compact
          />
          <SummaryCard
            title="Companies"
            value={String(new Set(staff.map((e) => e.companyId).filter(Boolean)).size)}
            icon={<Building2 className="h-5 w-5" />}
            variant="primary"
            caption="Entities covered"
            compact
          />
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Staff by department</h2>
          {byDepartment.length === 0 ? (
            <p className="text-sm text-muted-foreground">No staff records yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {byDepartment.map((d) => (
                <button
                  key={d.department}
                  onClick={() => setDepartment(department === d.department ? "all" : d.department)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    department === d.department
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-muted/40 hover:bg-muted"
                  }`}
                >
                  {d.department} · {d.count}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Name, Employee ID, passport, designation…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={designation} onValueChange={setDesignation}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Designation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All designations</SelectItem>
                {designations.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={company} onValueChange={setCompany}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Company" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="[&>th]:whitespace-nowrap [&>th]:px-4">
                  <TableHead>Staff</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                <TableHead className="!pr-6 text-right">Fixed Salary</TableHead>
                <TableHead className="!pl-6">Passport</TableHead>
                <TableHead className="!pl-6">Leave</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="sticky right-0 z-10 bg-card text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
                      <EmptyState
                        className="border-0 bg-transparent"
                        icon={<Briefcase className="h-5 w-5" />}
                        title="No staff found"
                        description="No office staff match these filters."
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((e) => (
                    <TableRow
                      key={e.id}
                      className="[&>td]:whitespace-nowrap [&>td]:px-4 [&>td]:py-3 [&>td]:align-middle"
                    >
                      <TableCell>
                        <Link
                          to="/workforce/$slug"
                          params={{ slug: employeeSlugById(e.id) }}
                          className="font-medium text-primary hover:underline"
                        >
                          {e.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          Employee ID: {e.employeeCode}
                        </div>
                      </TableCell>
                      <TableCell>
                        {companies.find((c) => c.id === e.companyId)?.name ?? "—"}
                      </TableCell>
                      <TableCell>{e.department ?? "—"}</TableCell>
                      <TableCell>{e.trade ?? "—"}</TableCell>
                      <TableCell className="!pr-6 text-right font-medium tabular-nums">
                        ${(e.basicSalary || 0).toLocaleString()}
                        <span className="ml-1 text-xs text-muted-foreground">/mo</span>
                      </TableCell>
                      <TableCell className="!pl-6">
                        <ExpiryCell date={e.passportExpiry} />
                      </TableCell>
                      <TableCell className="!pl-6">
                        {onLeaveToday.some((l) => l.employeeId === e.id) ? (
                          <StatusBadge variant="warning" dot label="On leave" />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge variant="success" label={e.status} dot />
                      </TableCell>
                      <TableCell className="sticky right-0 z-10 bg-card">
                        <div className="flex items-center justify-end gap-1.5">
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
                            onClick={() => setEditingStaff(e)}
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
        </div>

        <Dialog open={!!editingStaff} onOpenChange={(open) => !open && setEditingStaff(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Edit staff</DialogTitle>
              <DialogDescription>
                Update details for Employee ID {editingStaff?.employeeCode}.
              </DialogDescription>
            </DialogHeader>
            {editingStaff && <EmployeeForm employee={editingStaff} onSubmit={handleEdit} />}
          </DialogContent>
        </Dialog>

        <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete staff?</DialogTitle>
              <DialogDescription>
                This will permanently remove {deleteTarget?.name} (Employee ID{" "}
                {deleteTarget?.employeeCode}). This action cannot be undone.
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
