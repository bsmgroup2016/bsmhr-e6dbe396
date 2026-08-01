import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { IdCard, AlertTriangle, Search, Plus, Trash2, Download, Gauge, Users } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getEmployees, getVehicles, getDriverProfiles,
  upsertDriverProfile, deleteDriverProfile, driverLicenceAlerts,
} from "@/lib/store";
import { isDriver } from "@/lib/workforce-split";
import { employeeSlugById } from "@/lib/employee-slug";
import { exportRows } from "@/lib/xlsx";
import type { DriverProfile } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/drivers")({
  head: () => ({
    meta: [
      { title: "Driver Directory — BSM Workforce & Operations" },
      { name: "description", content: "Driver roster with driving licence classes, vocational licence, demerit points and vehicle assignment." },
      { property: "og:title", content: "Driver Directory — BSM Workforce & Operations" },
      { property: "og:description", content: "Driver roster with licence validity, vocational licence and vehicle assignment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DriversPage,
});

const vlTypes = ["None", "BDVL (Bus)", "TDVL (Taxi)", "PDVL (Private Hire)", "Class 4 Heavy Vehicle", "Forklift Licence"];

const emptyForm = {
  employeeId: "", licenceNo: "", licenceClasses: "", licenceIssueDate: "", licenceExpiry: "",
  vocationalLicenceType: "None", vocationalLicenceNo: "", vocationalLicenceExpiry: "",
  yearsExperience: 0, demeritPoints: 0, assignedVehicleId: "", medicalCheckupDue: "",
  status: "Active" as DriverProfile["status"], remarks: "",
};

const today = () => new Date().toISOString().slice(0, 10);

function daysLeft(date?: string) {
  if (!date) return null;
  return Math.round((new Date(`${date}T00:00:00+08:00`).getTime() - Date.now()) / 86_400_000);
}

function ExpiryCell({ date }: { date?: string }) {
  const left = daysLeft(date);
  if (!date || left === null) return <span className="text-muted-foreground">—</span>;
  return (
    <div>
      <div>{date}</div>
      <StatusBadge
        variant={left < 0 ? "destructive" : left <= 60 ? "warning" : "success"}
        label={left < 0 ? "Expired" : `${left} days left`}
        dot
      />
    </div>
  );
}

function DriversPage() {
  const [profiles, setProfiles] = useState(getDriverProfiles());
  const employees = getEmployees();
  const vehicles = getVehicles();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const refresh = () => setProfiles(getDriverProfiles());

  const driverEmployees = employees.filter(
    (e) => isDriver(e),
  );
  const emp = (id: string) => employees.find((e) => e.id === id);
  const plate = (id?: string) => (id ? vehicles.find((v) => v.id === id)?.plateNo ?? "—" : "—");

  const rows = driverEmployees.map((e) => ({
    employee: e,
    profile: profiles.find((p) => p.employeeId === e.id),
  }));

  const q = search.trim().toLowerCase();
  const filtered = rows.filter(
    (r) =>
      !q ||
      r.employee.name.toLowerCase().includes(q) ||
      r.employee.employeeCode.toLowerCase().includes(q) ||
      (r.profile?.licenceNo ?? "").toLowerCase().includes(q),
  );

  const driverIds = new Set(driverEmployees.map((e) => e.id));
  const alerts = driverLicenceAlerts(60).filter((a) => driverIds.has(a.profile.employeeId));
  const withProfile = rows.filter((r) => r.profile).length;
  const suspended = rows.filter((r) => r.profile?.status === "Suspended").length;

  function openForm(employeeId: string, profile?: DriverProfile) {
    setForm(
      profile
        ? {
            employeeId,
            licenceNo: profile.licenceNo ?? "",
            licenceClasses: profile.licenceClasses ?? "",
            licenceIssueDate: profile.licenceIssueDate ?? "",
            licenceExpiry: profile.licenceExpiry ?? "",
            vocationalLicenceType: profile.vocationalLicenceType ?? "None",
            vocationalLicenceNo: profile.vocationalLicenceNo ?? "",
            vocationalLicenceExpiry: profile.vocationalLicenceExpiry ?? "",
            yearsExperience: profile.yearsExperience,
            demeritPoints: profile.demeritPoints,
            assignedVehicleId: profile.assignedVehicleId ?? "",
            medicalCheckupDue: profile.medicalCheckupDue ?? "",
            status: profile.status,
            remarks: profile.remarks ?? "",
          }
        : { ...emptyForm, employeeId },
    );
    setOpen(true);
  }

  function save() {
    if (!form.employeeId) return toast.error("Select a driver");
    upsertDriverProfile({
      ...form,
      assignedVehicleId: form.assignedVehicleId || undefined,
      vocationalLicenceType: form.vocationalLicenceType === "None" ? undefined : form.vocationalLicenceType,
    });
    setOpen(false);
    refresh();
    toast.success("Driver record saved");
  }

  function handleExport() {
    void exportRows(
      filtered.map((r) => ({
        "P-File No": r.employee.employeeCode,
        Name: r.employee.name,
        "Licence no": r.profile?.licenceNo ?? "",
        Classes: r.profile?.licenceClasses ?? "",
        "Licence expiry": r.profile?.licenceExpiry ?? "",
        "Vocational licence": r.profile?.vocationalLicenceType ?? "",
        "VL expiry": r.profile?.vocationalLicenceExpiry ?? "",
        "Demerit points": r.profile?.demeritPoints ?? 0,
        Vehicle: plate(r.profile?.assignedVehicleId),
        Status: r.profile?.status ?? "No record",
      })),
      "drivers", "Drivers",
    );
  }

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Driver Directory</h1>
            <p className="text-sm text-muted-foreground">
              Driving licence classes, vocational licence, demerit points and assigned vehicle.
            </p>
          </div>
          <div className="mt-2 flex gap-2 sm:mt-0">
            <Button size="sm" variant="outline" onClick={handleExport} disabled={filtered.length === 0}>
              <Download className="mr-1 h-4 w-4" /> Export
            </Button>
            <Button size="sm" onClick={() => openForm("")} disabled={driverEmployees.length === 0}>
              <Plus className="mr-1 h-4 w-4" /> Driver record
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Drivers" value={driverEmployees.length.toString()} icon={<Users className="h-5 w-5" />} variant="primary" caption="Designation: Driver" compact />
          <SummaryCard title="Licence records" value={withProfile.toString()} icon={<IdCard className="h-5 w-5" />} variant="info" caption="Profiles completed" compact />
          <SummaryCard title="Licence alerts" value={alerts.length.toString()} icon={<AlertTriangle className="h-5 w-5" />} variant="warning" caption="Next 60 days" compact />
          <SummaryCard title="Suspended" value={suspended.toString()} icon={<Gauge className="h-5 w-5" />} variant="destructive" caption="Not allowed to drive" compact />
        </div>

        {alerts.length > 0 && (
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h2 className="text-sm font-medium text-muted-foreground">Licence & medical renewals</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {alerts.slice(0, 6).map((a, i) => (
                <li key={`${a.profile.id}-${i}`} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span className="font-medium">
                    {emp(a.profile.employeeId)?.name ?? "Driver"} — {a.label}
                  </span>
                  <StatusBadge variant={a.expired ? "destructive" : "warning"} label={a.date} dot />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" placeholder="Name, P-File No or licence no..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Driver</TableHead>
                  <TableHead>Licence no / classes</TableHead>
                  <TableHead>Licence expiry</TableHead>
                  <TableHead>Vocational licence</TableHead>
                  <TableHead>Demerit</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="sticky right-0 bg-card w-28 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <EmptyState className="border-0 bg-transparent" icon={<IdCard className="h-5 w-5" />} title="No drivers" description="Add an employee with designation Driver first." />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.employee.id}>
                      <TableCell>
                        <Link to="/workforce/$slug" params={{ slug: employeeSlugById(r.employee.id) }} className="font-medium text-primary hover:underline">
                          {r.employee.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">P-File No: {r.employee.employeeCode}</div>
                      </TableCell>
                      <TableCell>
                        <div>{r.profile?.licenceNo || "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.profile?.licenceClasses || "—"}</div>
                      </TableCell>
                      <TableCell><ExpiryCell date={r.profile?.licenceExpiry} /></TableCell>
                      <TableCell>
                        <div>{r.profile?.vocationalLicenceType || "—"}</div>
                        <div className="text-xs text-muted-foreground">{r.profile?.vocationalLicenceExpiry || "—"}</div>
                      </TableCell>
                      <TableCell>{r.profile?.demeritPoints ?? 0}</TableCell>
                      <TableCell>{plate(r.profile?.assignedVehicleId)}</TableCell>
                      <TableCell>
                        <StatusBadge
                          variant={!r.profile ? "ghost" : r.profile.status === "Active" ? "success" : r.profile.status === "Suspended" ? "destructive" : "warning"}
                          label={r.profile?.status ?? "No record"}
                          dot
                        />
                      </TableCell>
                      <TableCell className="sticky right-0 bg-card">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => openForm(r.employee.id, r.profile)}>
                            {r.profile ? "Edit" : "Add"}
                          </Button>
                          {r.profile && (
                            <Button size="icon" variant="ghost" title="Delete record" onClick={() => { deleteDriverProfile(r.profile!.id); refresh(); }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Driver record</DialogTitle>
              <DialogDescription>Licence details, vocational licence and vehicle assignment.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label>Driver</Label>
                <Select value={form.employeeId} onValueChange={(v) => setForm({ ...form, employeeId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
                  <SelectContent>
                    {driverEmployees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name} — {e.employeeCode}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Licence no</Label><Input value={form.licenceNo} onChange={(e) => setForm({ ...form, licenceNo: e.target.value })} /></div>
              <div><Label>Licence classes</Label><Input value={form.licenceClasses} onChange={(e) => setForm({ ...form, licenceClasses: e.target.value })} placeholder="Class 3, Class 4" /></div>
              <div><Label>Licence issue date</Label><Input type="date" value={form.licenceIssueDate} onChange={(e) => setForm({ ...form, licenceIssueDate: e.target.value })} /></div>
              <div><Label>Licence expiry</Label><Input type="date" value={form.licenceExpiry} onChange={(e) => setForm({ ...form, licenceExpiry: e.target.value })} /></div>
              <div>
                <Label>Vocational licence</Label>
                <Select value={form.vocationalLicenceType} onValueChange={(v) => setForm({ ...form, vocationalLicenceType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {vlTypes.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>VL number</Label><Input value={form.vocationalLicenceNo} onChange={(e) => setForm({ ...form, vocationalLicenceNo: e.target.value })} /></div>
              <div><Label>VL expiry</Label><Input type="date" value={form.vocationalLicenceExpiry} onChange={(e) => setForm({ ...form, vocationalLicenceExpiry: e.target.value })} /></div>
              <div><Label>Medical checkup due</Label><Input type="date" value={form.medicalCheckupDue} onChange={(e) => setForm({ ...form, medicalCheckupDue: e.target.value })} /></div>
              <div><Label>Years of experience</Label><Input type="number" value={form.yearsExperience} onChange={(e) => setForm({ ...form, yearsExperience: Number(e.target.value) })} /></div>
              <div><Label>Demerit points</Label><Input type="number" value={form.demeritPoints} onChange={(e) => setForm({ ...form, demeritPoints: Number(e.target.value) })} /></div>
              <div>
                <Label>Assigned vehicle</Label>
                <Select value={form.assignedVehicleId} onValueChange={(v) => setForm({ ...form, assignedVehicleId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (<SelectItem key={v.id} value={v.id}>{v.plateNo} — {v.type}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as DriverProfile["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["Active", "Suspended", "Inactive"] as DriverProfile["status"][]).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2"><Label>Remarks</Label><Textarea value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <p className="text-xs text-muted-foreground">Records as of {today()} (SGT).</p>
      </div>
    </AppShell>
  );
}
