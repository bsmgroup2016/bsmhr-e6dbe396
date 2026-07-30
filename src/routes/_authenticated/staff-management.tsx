import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, Building2, Search, Users } from "lucide-react";

import { AppShell } from "@/components/app-shell";
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
import { getEmployees, getCompanies } from "@/lib/store";
import { employeeSlugById } from "@/lib/employee-slug";
import { isOfficeStaff } from "@/lib/workforce-split";



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
  const staff = getEmployees().filter(isOfficeStaff);

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
              Office and administrative staff — HR, Accounts, IT, Admin and QS.
            </p>
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
                placeholder="Name, P-File, passport, designation…"
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

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
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
                    <TableRow key={e.id}>
                      <TableCell>
                        <Link
                          to="/workforce/$slug"
                          params={{ slug: employeeSlugById(e.id) }}
                          className="font-medium text-primary hover:underline"
                        >
                          {e.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          P-File No: {e.employeeCode}
                        </div>
                      </TableCell>
                      <TableCell>
                        {companies.find((c) => c.id === e.companyId)?.name ?? "—"}
                      </TableCell>
                      <TableCell>{e.department ?? "—"}</TableCell>
                      <TableCell>{e.trade ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge variant="success" label={e.status} dot />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
