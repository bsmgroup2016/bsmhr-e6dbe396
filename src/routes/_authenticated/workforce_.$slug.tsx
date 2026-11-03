import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, Pencil, Ban, LogOut, Archive, Upload, CalendarCheck, Wallet, Briefcase,
  FileText, Download, Trash2,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { R2Image } from "@/components/r2-image";
import { deletePFileReference } from "@/core/p-file-deletion";
import { EmployeeForm, employeeFromForm } from "@/components/employee-form";
import { IPA_DETAIL_FIELDS } from "@/core/ipa-detail-fields";
import { estimatedWorkPermitExpiry } from "@/core/work-permit-expiry";
import { employeeFormDocuments } from "@/core/employee-form-documents";
import { addDocument } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  getEmployees, updateEmployee, getAssignmentsByEmployee, getAttendanceByEmployee,
  getPayrollByEmployee, getDocumentsByEmployee, getAuditLogs, getSites, getProjects, getClients,
} from "@/lib/store";
import type { Employee } from "@/lib/types";
import { findEmployeeByParam } from "@/lib/employee-slug";
import { isOfficeStaff } from "@/lib/workforce-split";
import { uploadToR2, deleteFromR2, openR2File, downloadR2File, r2FileName } from "@/lib/r2";

export const Route = createFileRoute("/_authenticated/workforce_/$slug")({
  head: () => ({
    meta: [
      { title: "Employee profile — BSM Workforce & Operations" },
      { name: "description", content: "Full employee profile: personal, employment, pass, payroll and documents." },
      { property: "og:title", content: "Employee profile — BSM Workforce & Operations" },
      { property: "og:description", content: "Full employee profile: personal, employment, pass, payroll and documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmployeeProfilePage,
});

function IpaItems({ employee, section }: { employee: Employee; section: string }) {
  return <>{IPA_DETAIL_FIELDS.filter((field) => field.section === section).map((field) =>
    <Item key={field.key} label={field.label} value={employee[field.key]} />,
  )}</>;
}

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
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [, force] = useState(0);
  const [editing, setEditing] = useState(false);
  const employee = findEmployeeByParam(getEmployees(), slug);

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
  /** Staff carry an Employee ID and a fixed monthly salary — no hourly/site data. */
  const staff = isOfficeStaff(employee);

  function patch(updates: Partial<Employee>) {
    if (!employee) return;
    updateEmployee(employee.id, updates);
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
                  {staff ? "Employee ID" : "P-File No"} {employee.employeeCode} •{" "}
                  {employee.department ?? (staff ? "Office" : "Construction")} • {employee.trade}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge variant={statusVariant(employee.status)} dot label={employee.status} />
                  {!staff ? (
                    <StatusBadge variant="outline" label={employee.deploymentStatus ?? "Available"} />
                  ) : null}
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
              <p className="text-muted-foreground">{staff ? "Fixed Salary" : "Basic rate"}</p>
              <p className="text-lg font-semibold">
                ${employee.basicSalary.toLocaleString()}
                <span className="text-xs font-normal text-muted-foreground">
                  {staff ? "/month" : "/day"}
                </span>
              </p>
              {!staff ? (
                <p className="text-xs text-muted-foreground">OT rate ${(employee.otRate ?? 0).toFixed(2)}/hr</p>
              ) : null}
              <p className="text-xs text-muted-foreground">Joined {employee.joinedOn || "—"}</p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
            <Button size="sm" onClick={() => setEditing(true)}>
              <Pencil className="mr-1 h-4 w-4" /> Edit employee
            </Button>
            {!staff ? (
              <>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/operations"><Briefcase className="mr-1 h-4 w-4" /> Assign to project</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/time-management" search={{ new: undefined, offset: 0, date: new Date().toISOString().slice(0, 10), month: new Date().toISOString().slice(0, 7), view: "day", company: "", group: "all", status: "all", designation: "all", employee: "all", search: "", noLocation: false }}><CalendarCheck className="mr-1 h-4 w-4" /> Record attendance</Link>
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" asChild>
                <Link to="/leave"><CalendarCheck className="mr-1 h-4 w-4" /> Leave records</Link>
              </Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link to="/documents" search={{ employee: employee.id }}><Upload className="mr-1 h-4 w-4" /> Upload document</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/payroll"><Wallet className="mr-1 h-4 w-4" /> View payroll</Link>
            </Button>
            {!staff ? (
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
            ) : null}
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

        <Tabs value={profileTab} onValueChange={setProfileTab}>
          <TabsList className="flex w-full flex-wrap">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="employment">Employment</TabsTrigger>
            <TabsTrigger value="pass">Work pass &amp; Certificate</TabsTrigger>
            <TabsTrigger value="pay">Compensation</TabsTrigger>
            {!staff ? <TabsTrigger value="assignments">Assignments</TabsTrigger> : null}
            {!staff ? <TabsTrigger value="attendance">Attendance</TabsTrigger> : null}
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="notes">Notes</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Grid>
              <Item
                label={staff ? "Employee ID" : "P-File Number"}
                value={employee.employeeCode}
              />
              <Item label="Department" value={employee.department} />
              <Item label="Designation" value={employee.trade} />
              <Item label="Employment status" value={employee.status} />
              {staff ? (
                <>
                  <Item
                    label="Fixed salary / month"
                    value={`$${employee.basicSalary.toLocaleString()}`}
                  />
                  <Item label="Payroll frequency" value={employee.payrollFrequency ?? "Monthly"} />
                  <Item label="Reporting manager" value={employee.reportingManager} />
                  <Item label="Work Permit number" value={employee.workPermitNumber} />
                </>
              ) : (
                <>
                  <Item label="Worker category" value={employee.workerCategory} />
                  <Item label="Deployment status" value={employee.deploymentStatus ?? "Available"} />
                  <Item label="Current client" value={activeClient?.name} />
                  <Item label="Current project" value={activeProject?.name} />
                  <Item label="Current site" value={activeSite?.name} />
                  <Item label="Supervisor" value={employee.siteSupervisor} />
                </>
              )}
              <Item label="Joining date" value={employee.joinedOn} />
              <Item label="Pass expiry" value={employee.workPermitExpiryDate ?? employee.passExpiry} />
              <Item label="Passport expiry" value={employee.passportExpiry} />
            </Grid>
          </TabsContent>

          {FORM_TABS.includes(profileTab) ? (
            <div className="mt-4 rounded-lg border bg-card p-4">
              <EmployeeForm key={`${employee.id}-${version}`} employee={employee} readOnly tab={profileTab} onSubmit={(fd) => {
                updateEmployee(employee.id, employeeFromForm(fd));
                for (const document of employeeFormDocuments(fd, getDocumentsByEmployee(employee.id))) addDocument({ ...document, employeeId: employee.id });
                force((n) => n + 1);
              }} />
            </div>
          ) : null}








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
                `$${p.basicSalary.toLocaleString()}`,
                `$${p.overtimePay.toLocaleString()}`,
                `$${(p.deductions + p.cpfEmployee).toLocaleString()}`,
                `$${p.netPay.toLocaleString()}`,
                p.status,
              ])}
              empty="No payroll entries yet."
            />
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
                for (const document of employeeFormDocuments(fd, getDocumentsByEmployee(employee.id))) addDocument({ ...document, employeeId: employee.id });
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
  // eslint-disable-next-line no-empty
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

/** Manual upload / view / delete of the employee's scanned P-File PDF. */
function PFilePanel({
  employee,
  onChange,
}: {
  employee: Employee;
  onChange: (url: string | undefined) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | "upload" | "delete">(null);
  const [error, setError] = useState<string | null>(null);
  const url = employee.pFileUrl;

  async function handleFile(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Particular must be a PDF file.");
      return;
    }
    setBusy("upload");
    try {
      const result = await uploadToR2(file, "p-files");
      onChange(result.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!url) return;
    setError(null);
    setBusy("delete");
    try {
      await deletePFileReference(url, deleteFromR2, () => onChange(undefined));
    } catch (error) {
      setError(error instanceof Error ? error.message : "Delete failed. The Particular reference has been kept.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-4 rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">Particular (PDF)</h3>
          <p className="text-xs text-muted-foreground">
            {url
              ? r2FileName(url)
              : "No Particular uploaded yet — upload the scanned PDF for this employee."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {url ? (
            <>
              <Button size="sm" variant="outline" onClick={() => void openR2File(url)}>
                <FileText className="mr-1.5 h-4 w-4" />
                View
              </Button>
              <Button size="sm" variant="outline" onClick={() => void downloadR2File(url)}>
                <Download className="mr-1.5 h-4 w-4" />
                Download
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="mr-1.5 h-4 w-4" />
                Replace
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={busy !== null}
                onClick={() => void handleDelete()}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={busy !== null} onClick={() => inputRef.current?.click()}>
              <Upload className="mr-1.5 h-4 w-4" />
              {busy === "upload" ? "Uploading…" : "Upload Particular PDF"}
            </Button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}