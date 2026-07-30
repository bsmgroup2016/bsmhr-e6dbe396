import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, Pencil, Ban, LogOut, Archive, Upload, CalendarCheck, Wallet, Briefcase,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { R2Image } from "@/components/r2-image";
import { EmployeeForm, employeeFromForm } from "@/components/employee-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getEmployee, updateEmployee, getAssignmentsByEmployee, getAttendanceByEmployee,
  getPayrollByEmployee, getDocumentsByEmployee, getAuditLogs, getSites, getProjects, getClients,
} from "@/lib/store";
import type { Employee } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/workforce/$id")({
  head: () => ({
    meta: [
      { title: "Employee profile — BSM Workforce & Operations" },
      { name: "description", content: "Full employee profile: personal, employment, pass, payroll and documents." },
      { property: "og:title", content: "Employee profile — BSM Workforce & Operations" },
      { property: "og:description", content: "Full employee profile: personal, employment, pass, payroll and documents." },
    ],
  }),
  component: EmployeeProfilePage,
});

function daysUntil(iso?: string): number | null {
  if (!iso || iso === "-") return null;
  const target = new Date(`${iso}T00:00:00+08:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target.getTime() - Date.now()) / 86_400_000);
}

function ExpiryBadge({ date, label }: { date?: string; label: string }) {
  const days = daysUntil(date);
  if (days === null) return null;
  const variant = days < 0 ? "destructive" : days <= 60 ? "warning" : "success";
  return <StatusBadge variant={variant} dot label={`${label}: ${days < 0 ? "expired" : `${days}d left`}`} />;
}

function statusVariant(status: Employee["status"]) {
  if (status === "Active") return "success" as const;
  if (status === "Deployed") return "info" as const;
  if (status === "On Leave" || status === "Pending Approval" || status === "Suspended") return "warning" as const;
  if (status === "Terminated" || status === "Repatriated") return "destructive" as const;
  return "ghost" as const;
}

function Item({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="text-sm font-medium text-foreground">{value === undefined || value === null || value === "" ? "—" : value}</p>
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 rounded-xl border bg-card p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function EmployeeProfilePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [, force] = useState(0);
  const [editing, setEditing] = useState(false);
  const employee = getEmployee(id);

  if (!employee) {
    return (
      <AppShell>
        <div className="mx-auto max-w-3xl py-10">
          <EmptyState
            title="Employee not found"
            description="This record may have been deleted."
            action={{ label: "Back to employees", onClick: () => navigate({ to: "/workforce" }) }}
          />
        </div>
      </AppShell>
    );
  }

  const assignments = getAssignmentsByEmployee(employee.id);
  const attendance = getAttendanceByEmployee(employee.id).slice(0, 30);
  const payroll = getPayrollByEmployee(employee.id);
  const documents = getDocumentsByEmployee(employee.id);
  const activity = getAuditLogs().filter((l) => l.entityId === employee.id).slice(0, 40);
  const sites = getSites();
  const projects = getProjects();
  const clients = getClients();

  const active = assignments.find((a) => a.status === "Active");
  const activeSite = sites.find((s) => s.id === active?.siteId);
  const activeProject = projects.find((p) => p.id === active?.projectId);
  const activeClient = clients.find((c) => c.id === activeProject?.clientId);

  function patch(updates: Partial<Employee>) {
    updateEmployee(id, updates);
    force((n) => n + 1);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/workforce" })} className="-ml-2">
          <ArrowLeft className="mr-1 h-4 w-4" />
          All employees
        </Button>

        {/* Profile header */}
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <R2Image
                src={employee.photoUrl}
                alt={employee.name}
                className="h-20 w-20 rounded-xl object-cover ring-1 ring-border"
                fallback={
                  <span className="flex h-20 w-20 items-center justify-center rounded-xl bg-primary/10 text-xl font-semibold text-primary">
                    {employee.name.slice(0, 2).toUpperCase()}
                  </span>
                }
              />
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">{employee.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {employee.employeeCode} • {employee.workerCategory ?? "Worker"} • {employee.trade}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge variant={statusVariant(employee.status)} dot label={employee.status} />
                  <StatusBadge variant="outline" label={employee.deploymentStatus ?? "Available"} />
                  <ExpiryBadge date={employee.passExpiry} label="Pass" />
                  <ExpiryBadge date={employee.passportExpiry} label="Passport" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {activeClient ? `${activeClient.name} • ` : ""}
                  {activeProject ? `${activeProject.name} • ` : ""}
                  {activeSite ? activeSite.name : "No active site"}
                </p>
              </div>
            </div>
            <div className="text-right text-sm">
              <p className="text-muted-foreground">Basic</p>
              <p className="text-lg font-semibold">S${employee.basicSalary.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">OT rate S${(employee.otRate ?? 0).toFixed(2)}/hr</p>
              <p className="text-xs text-muted-foreground">Joined {employee.joinedOn || "—"}</p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-4 w-4" /> Edit employee
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/operations"><Briefcase className="mr-1 h-4 w-4" /> Assign to project</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/time-management"><CalendarCheck className="mr-1 h-4 w-4" /> Record attendance</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/documents" search={{ employee: employee.id }}><Upload className="mr-1 h-4 w-4" /> Upload document</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/payroll"><Wallet className="mr-1 h-4 w-4" /> View payroll</Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                patch({ deploymentStatus: employee.deploymentStatus === "Blocked" ? "Available" : "Blocked" })
              }
            >
              <Ban className="mr-1 h-4 w-4" />
              {employee.deploymentStatus === "Blocked" ? "Unblock deployment" : "Block deployment"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                patch({
                  status: "Resigned",
                  deploymentStatus: "Not Deployable",
                  lastWorkingDate: new Date().toISOString().slice(0, 10),
                })
              }
            >
              <LogOut className="mr-1 h-4 w-4" /> End employment
            </Button>
            <Button size="sm" variant="outline" onClick={() => patch({ status: "Archived", deploymentStatus: "Not Deployable" })}>
              <Archive className="mr-1 h-4 w-4" /> Archive
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="flex w-full flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="employment">Employment</TabsTrigger>
            <TabsTrigger value="pass">Work pass</TabsTrigger>
            <TabsTrigger value="pay">Compensation</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Grid>
              <Item label="P-File Number" value={employee.employeeCode} />
              <Item label="Worker category" value={employee.workerCategory} />
              <Item label="Primary skill" value={employee.trade} />
              <Item label="Employment status" value={employee.status} />
              <Item label="Deployment status" value={employee.deploymentStatus ?? "Available"} />
              <Item label="Current client" value={activeClient?.name} />
              <Item label="Current project" value={activeProject?.name} />
              <Item label="Current site" value={activeSite?.name} />
              <Item label="Supervisor" value={employee.siteSupervisor} />
              <Item label="Joining date" value={employee.joinedOn} />
              <Item label="Pass expiry" value={employee.passExpiry} />
              <Item label="Passport expiry" value={employee.passportExpiry} />
            </Grid>
          </TabsContent>

          <TabsContent value="personal" className="mt-4">
            <Grid>
              <Item label="Full legal name" value={employee.name} />
              <Item label="Preferred name" value={employee.preferredName} />
              <Item label="Date of birth" value={employee.dateOfBirth} />
              <Item label="Gender" value={employee.gender} />
              <Item label="Nationality" value={employee.nationality} />
              <Item label="Marital status" value={employee.maritalStatus} />
              <Item label="Email" value={employee.email} />
              <Item label="Mobile phone" value={employee.phone} />
              <Item label="Alternative phone" value={employee.altPhone} />
              <Item label="Singapore address" value={employee.address} />
              <Item label="Home-country address" value={employee.homeCountryAddress} />
              <Item label="Postal code" value={employee.postalCode} />
              <Item label="Emergency contact" value={employee.emergencyContact} />
              <Item label="Relationship" value={employee.emergencyRelation} />
              <Item label="Emergency phone" value={employee.emergencyPhone} />
              <Item label="Emergency email" value={employee.emergencyEmail} />
              <Item label="Bank name" value={employee.bankName} />
              <Item label="Bank account" value={employee.bankAccount} />
              <Item label="Payment method" value={employee.paymentMethod} />
            </Grid>
          </TabsContent>

          <TabsContent value="employment" className="mt-4">
            <Grid>
              <Item label="Branch" value={employee.branch} />
              <Item label="Department" value={employee.department} />
              <Item label="Employment type" value={employee.employmentType} />
              <Item label="Worker category" value={employee.workerCategory} />
              <Item label="Job title" value={employee.jobTitle} />
              <Item label="Primary skill" value={employee.trade} />
              <Item label="Secondary skills" value={employee.secondarySkills} />
              <Item label="Application date" value={employee.applicationDate} />
              <Item label="Joining date" value={employee.joinedOn} />
              <Item label="Confirmation date" value={employee.confirmationDate} />
              <Item label="Contract start" value={employee.contractStart} />
              <Item label="Contract end" value={employee.contractEnd} />
              <Item label="Employment status" value={employee.status} />
              <Item label="Deployment status" value={employee.deploymentStatus} />
              <Item label="Reporting manager" value={employee.reportingManager} />
              <Item label="Site supervisor" value={employee.siteSupervisor} />
              <Item label="Payroll group" value={employee.payrollGroup} />
              <Item label="Payroll frequency" value={employee.payrollFrequency} />
              <Item label="Last working date" value={employee.lastWorkingDate} />
              <Item label="Exit reason" value={employee.exitReason} />
            </Grid>
          </TabsContent>

          <TabsContent value="pass" className="mt-4">
            <Grid>
              <Item label="FIN / NRIC" value={employee.fin} />
              <Item label="Pass type" value={employee.passType} />
              <Item label="Work Permit number" value={employee.workPermitNumber} />
              <Item label="Pass expiry" value={employee.passExpiry} />
              <Item label="Passport number" value={employee.passportNumber} />
              <Item label="Passport expiry" value={employee.passportExpiry} />
              <Item label="Accommodation" value={employee.dormitory} />
            </Grid>
          </TabsContent>

          <TabsContent value="pay" className="mt-4">
            <Grid>
              <Item label="Basic salary" value={`S$${employee.basicSalary.toLocaleString()}`} />
              <Item label="OT rate / hour" value={employee.otRate ? `S$${employee.otRate}` : undefined} />
              <Item label="Normal hours / day" value={employee.normalHours} />
              <Item label="Monthly levy" value={employee.levyRate ? `S$${employee.levyRate}` : undefined} />
              <Item label="Payroll group" value={employee.payrollGroup} />
              <Item label="Payroll frequency" value={employee.payrollFrequency} />
              <Item label="Bank name" value={employee.bankName} />
              <Item label="Bank account" value={employee.bankAccount} />
              <Item label="Payment method" value={employee.paymentMethod} />
            </Grid>
          </TabsContent>

          <TabsContent value="assignments" className="mt-4">
            <SimpleTable
              headers={["Project", "Site", "Start", "End", "Status"]}
              rows={assignments.map((a) => [
                projects.find((p) => p.id === a.projectId)?.name ?? "—",
                sites.find((s) => s.id === a.siteId)?.name ?? "—",
                a.startDate,
                a.endDate ?? "—",
                a.status,
              ])}
              empty="No assignment history yet."
            />
          </TabsContent>

          <TabsContent value="attendance" className="mt-4">
            <SimpleTable
              headers={["Date", "Status", "In", "Out", "Hours", "OT"]}
              rows={attendance.map((a) => [a.date, a.status, a.checkIn ?? "—", a.checkOut ?? "—", a.hoursWorked, a.overtimeHours])}
              empty="No attendance recorded yet."
            />
          </TabsContent>

          <TabsContent value="payroll" className="mt-4">
            <SimpleTable
              headers={["Month", "Basic", "OT", "Deductions", "Net pay", "Status"]}
              rows={payroll.map((p) => [
                p.month,
                `S$${p.basicSalary.toLocaleString()}`,
                `S$${p.overtimePay.toLocaleString()}`,
                `S$${(p.deductions + p.cpfEmployee).toLocaleString()}`,
                `S$${p.netPay.toLocaleString()}`,
                p.status,
              ])}
              empty="No payroll entries yet."
            />
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            <SimpleTable
              headers={["Type", "Name", "Issued", "Expiry", "Status"]}
              rows={documents.map((d) => [d.type, d.name, d.issueDate ?? "—", d.expiryDate ?? "—", d.status])}
              empty="No documents uploaded yet."
            />
            <div className="mt-3">
              <Button size="sm" variant="outline" asChild>
                <Link to="/documents" search={{ employee: employee.id }}>Manage documents</Link>
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <div className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
              <div>
                <Label className="text-xs text-muted-foreground">Remarks</Label>
                <p className="text-sm">{employee.remarks || "—"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Internal notes (HR only)</Label>
                <p className="text-sm">{employee.internalNotes || "—"}</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <SimpleTable
              headers={["When", "Action", "By", "Details"]}
              rows={activity.map((l) => [new Date(l.timestamp).toLocaleString(), l.action, l.userName, l.details])}
              empty="No activity recorded for this employee yet."
            />
          </TabsContent>
        </Tabs>

        <Dialog open={editing} onOpenChange={setEditing}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit employee</DialogTitle>
              <DialogDescription>Update details for {employee.employeeCode}.</DialogDescription>
            </DialogHeader>
            <EmployeeForm
              employee={employee}
              onSubmit={(fd) => {
                updateEmployee(employee.id, employeeFromForm(fd));
                setEditing(false);
                force((n) => n + 1);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

function SimpleTable({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: (string | number)[][];
  empty: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title="Nothing here yet" description={empty} />;
  }
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            {headers.map((h) => (
              <TableHead key={h}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={i}>
              {r.map((c, j) => (
                <TableCell key={j}>{c}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}