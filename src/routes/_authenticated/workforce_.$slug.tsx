import { useAuth } from "@/lib/auth";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { employeeCompanyId } from "@/core/employee-company";
import { getBranchPrefixes, subscribe, getCompanies, saveEmployeeConfirmed, saveEmployeeDocumentsConfirmed } from "@/lib/store";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft, Pencil, Ban, LogOut, Archive, Upload, CalendarCheck, Wallet, Briefcase,
  FileText, Download, Trash2, Home, Shield, Truck, Package,
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
  getDormitories, getAllocations, getAssets, getIssuances, getDriverProfile, getVehicles, getDriverIncidents,
} from "@/lib/store";
import type { Employee } from "@/lib/types";
import { findEmployeeByParam } from "@/lib/employee-slug";
import { isOfficeStaff } from "@/lib/workforce-split";
import { uploadToR2, deleteFromR2, openR2File, downloadR2File, r2FileName } from "@/lib/r2";

const FORM_TABS = ["personal", "employment", "pass", "pay", "documents"];

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
  const [version, force] = useState(0);
  useEffect(() => subscribe(() => force(n => n + 1)), []);
  const [profileTab, setProfileTab] = useState("personal");
  const { isAdmin } = useAuth();
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

  const dormitories = getDormitories();
  const workerAllocations = getAllocations().filter((a) => a.employeeId === employee.id);
  const activeAllocation = workerAllocations.find((a) => a.status === "Occupied") ?? workerAllocations[0];
  const activeDormitory = dormitories.find((d) => d.id === activeAllocation?.dormitoryId);

  const assets = getAssets();
  const workerIssuances = getIssuances().filter((i) => i.employeeId === employee.id);

  const driverProfile = getDriverProfile(employee.id);
  const vehicles = getVehicles();
  const assignedVehicle = vehicles.find((v) => v.id === driverProfile?.assignedVehicleId || v.driverEmployeeId === employee.id);
  const driverIncidents = getDriverIncidents().filter((i) => i.employeeId === employee.id);
  const isDriver = !!driverProfile || (employee.trade?.toLowerCase().includes("driver") ?? false) || !!assignedVehicle;

  const active = assignments.find((a) => a.status === "Active" || a.status === "Approved");
  const activeSite = sites.find((s) => s.id === active?.siteId);
  const activeProject = projects.find((p) => p.id === active?.projectId);
  const activeClient = clients.find((c) => c.id === activeProject?.clientId);
  /** Staff carry an Employee ID and a fixed monthly salary — no hourly/site data. */
  const staff = isOfficeStaff(employee);

  async function patch(updates: Partial<Employee>) {
    if (!employee) return;
    try { await saveEmployeeConfirmed(updates, employee.id); toast.success("Employee updated"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Employee update failed"); }
  }

  async function saveForm(fd: FormData) {
    if (!employee) return;
    const values = employeeFromForm(fd);
    await saveEmployeeConfirmed({ ...values, companyId: employeeCompanyId(values.branch, getCompanies(), employee.companyId, getBranchPrefixes()) }, employee.id);
    await saveEmployeeDocumentsConfirmed(employee.id, employeeFormDocuments(fd, getDocumentsByEmployee(employee.id)));
    setEditing(false); toast.success("Employee changes saved");
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
                  {activeDormitory ? (
                    <StatusBadge variant="outline" label={`Dorm: ${activeDormitory.name}${activeAllocation?.roomNo ? ` (Rm ${activeAllocation.roomNo})` : ""}`} />
                  ) : null}
                  {isDriver ? (
                    <StatusBadge variant="info" label={assignedVehicle ? `Driver (${assignedVehicle.plateNo})` : "Driver"} />
                  ) : null}
                  <ExpiryBadge date={employee.passExpiry} label="Pass" />
                  <ExpiryBadge date={employee.passportExpiry} label="Passport" />
                  <ExpiryBadge date={employee.workPermitExpiryDate} label="Work permit" />
                  <ExpiryBadge date={employee.safetyCourseExpiry} label="CSOC" />
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
                  <Link to="/time-management" search={{ new: undefined, offset: 0, date: new Date().toISOString().slice(0, 10), month: new Date().toISOString().slice(0, 7), view: "day", company: employee.companyId ?? "", group: "all", status: "all", designation: "all", employee: employee.id, search: "", noLocation: false }}><CalendarCheck className="mr-1 h-4 w-4" /> Attendance records</Link>
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" asChild>
                <Link to="/leave"><CalendarCheck className="mr-1 h-4 w-4" /> Leave records</Link>
              </Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link to="/documents" search={{ employee: employee.id }}><Upload className="mr-1 h-4 w-4" /> Employee documents</Link>
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
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="employment">Employment</TabsTrigger>
            <TabsTrigger value="pass">Work pass &amp; Certificate</TabsTrigger>
            <TabsTrigger value="pay">Compensation</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            {!staff ? <TabsTrigger value="attendance">Attendance</TabsTrigger> : null}
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
            <TabsTrigger value="accommodation">Accommodation</TabsTrigger>
            <TabsTrigger value="assets">PPE &amp; Assets</TabsTrigger>
            {isDriver ? <TabsTrigger value="driver">Fleet &amp; Driver</TabsTrigger> : null}
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
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
              <EmployeeForm key={employee.id} employee={employee} readOnly={!isAdmin} tab={profileTab} hideTabList onSubmit={saveForm} />
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

          <TabsContent value="accommodation" className="mt-4 space-y-4">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b">
                <div className="flex items-center gap-2">
                  <Home className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-foreground">Current Housing / Dormitory</h3>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/accommodation">Manage accommodation</Link>
                </Button>
              </div>
              {activeDormitory && activeAllocation ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Item label="Dormitory Name" value={activeDormitory.name} />
                  <Item label="Room Number" value={activeAllocation.roomNo} />
                  <Item label="Bed Number" value={activeAllocation.bedNo ?? "—"} />
                  <Item label="Monthly Rent" value={`$${activeAllocation.monthlyRent}`} />
                  <Item label="Allocation Status" value={activeAllocation.status} />
                  <Item label="Check-in Date" value={activeAllocation.checkInDate} />
                  <Item label="Check-out Date" value={activeAllocation.checkOutDate ?? "Active"} />
                  <Item label="Operator" value={activeDormitory.operator ?? "—"} />
                  <Item label="Operator Contact" value={activeDormitory.contactPerson ? `${activeDormitory.contactPerson} (${activeDormitory.contactPhone ?? "—"})` : "—"} />
                  <div className="sm:col-span-2 lg:col-span-3">
                    <Label className="text-xs text-muted-foreground">Address</Label>
                    <p className="text-sm font-medium text-foreground">{activeDormitory.address || employee.dormitoryAddress || "—"}</p>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No active dormitory room allocated for this worker.
                  {employee.dormitoryAddress ? (
                    <p className="mt-1 text-xs">Registered address: {employee.dormitoryAddress}</p>
                  ) : null}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Allocation History</h4>
              <SimpleTable
                headers={["Dormitory", "Room", "Bed", "Check-in", "Check-out", "Rent", "Status"]}
                rows={workerAllocations.map((a) => {
                  const dorm = dormitories.find((d) => d.id === a.dormitoryId);
                  return [
                    dorm?.name ?? "Dormitory",
                    a.roomNo,
                    a.bedNo ?? "—",
                    a.checkInDate,
                    a.checkOutDate ?? "Present",
                    `$${a.monthlyRent}`,
                    a.status,
                  ];
                })}
                empty="No accommodation history found for this worker."
              />
            </div>
          </TabsContent>

          <TabsContent value="assets" className="mt-4 space-y-4">
            <div className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-foreground">PPE &amp; Equipment Custody</h3>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link to="/assets">Issue new asset</Link>
                </Button>
              </div>
              <div className="mt-4 grid gap-4 grid-cols-3 text-center">
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="text-2xl font-bold text-foreground">
                    {workerIssuances.reduce((acc, i) => acc + i.quantity, 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Total items received</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="text-2xl font-bold text-primary">
                    {workerIssuances.filter((i) => i.status === "Issued").reduce((acc, i) => acc + i.quantity, 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Currently holding</div>
                </div>
                <div className="rounded-lg bg-muted/40 p-3">
                  <div className="text-2xl font-bold text-muted-foreground">
                    {workerIssuances.filter((i) => i.status === "Returned").reduce((acc, i) => acc + i.quantity, 0)}
                  </div>
                  <div className="text-xs text-muted-foreground">Returned</div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Issued Equipment &amp; PPE Records</h4>
              <SimpleTable
                headers={["Asset / PPE", "Category", "Qty", "Issue Date", "Due Date", "Return Date", "Condition", "Status"]}
                rows={workerIssuances.map((i) => {
                  const ast = assets.find((a) => a.id === i.assetId);
                  return [
                    ast?.name ?? "Asset",
                    ast?.category ?? "PPE",
                    i.quantity,
                    i.issueDate,
                    i.dueDate ?? "—",
                    i.returnDate ?? "—",
                    i.conditionIn ? `${i.conditionOut} → ${i.conditionIn}` : i.conditionOut,
                    i.status,
                  ];
                })}
                empty="No PPE or assets have been issued to this worker yet."
              />
            </div>
          </TabsContent>

          {isDriver ? (
            <TabsContent value="driver" className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-2 pb-2 border-b">
                    <Shield className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold text-foreground">Driver Credentials</h3>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Item label="Licence Classes" value={driverProfile?.licenceClasses ?? "Class 3 / 4"} />
                    <Item label="Licence Number" value={driverProfile?.licenceNo ?? "—"} />
                    <Item label="Licence Expiry" value={driverProfile?.licenceExpiry ?? "—"} />
                    <Item label="Demerit Points" value={driverProfile?.demeritPoints ?? 0} />
                    <Item label="Vocational Licence" value={driverProfile?.vocationalLicenceType ? `${driverProfile.vocationalLicenceType} (${driverProfile.vocationalLicenceNo ?? ""})` : "—"} />
                    <Item label="Medical Checkup Due" value={driverProfile?.medicalCheckupDue ?? "—"} />
                    <Item label="Status" value={driverProfile?.status ?? "Active"} />
                    <Item label="Experience" value={driverProfile?.yearsExperience ? `${driverProfile.yearsExperience} yrs` : "—"} />
                  </div>
                </div>

                <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b">
                    <div className="flex items-center gap-2">
                      <Truck className="h-5 w-5 text-primary" />
                      <h3 className="font-semibold text-foreground">Assigned Vehicle</h3>
                    </div>
                    <Button size="sm" variant="outline" asChild>
                      <Link to="/transport">Fleet</Link>
                    </Button>
                  </div>
                  {assignedVehicle ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Item label="Plate Number" value={assignedVehicle.plateNo} />
                      <Item label="Vehicle Type" value={assignedVehicle.type} />
                      <Item label="Make & Model" value={assignedVehicle.makeModel ?? "—"} />
                      <Item label="Capacity" value={assignedVehicle.capacity ? `${assignedVehicle.capacity} seats` : "—"} />
                      <Item label="Road Tax Expiry" value={assignedVehicle.roadTaxExpiry ?? "—"} />
                      <Item label="Inspection Due" value={assignedVehicle.inspectionDue ?? "—"} />
                      <Item label="Vehicle Status" value={assignedVehicle.status} />
                    </div>
                  ) : (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No vehicle currently assigned to this driver.
                    </div>
                  )}
                </div>
              </div>

              {driverIncidents.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Traffic &amp; Vehicle Incidents</h4>
                  <SimpleTable
                    headers={["Date", "Incident Type", "Vehicle", "Remarks"]}
                    rows={driverIncidents.map((inc) => {
                      const veh = vehicles.find((v) => v.id === inc.vehicleId);
                      return [
                        inc.date,
                        inc.incidentType,
                        veh?.plateNo ?? "—",
                        inc.remarks ?? "—",
                      ];
                    })}
                    empty="No driver incidents recorded."
                  />
                </div>
              ) : null}
            </TabsContent>
          ) : null}



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
              onSubmit={saveForm}
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
  rows: (string | number | React.ReactNode)[][];
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