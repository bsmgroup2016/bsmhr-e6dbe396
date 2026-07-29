import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Calendar,
  Clock,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
  FileSpreadsheet,
  MapPin,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ExportButton, ImportDialog } from "@/components/data-io";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { getEmployees, getSites, getAttendance, addAttendance, saveDailySheet, getCurrentCompany } from "@/lib/store";
import { GeoCapture } from "@/components/geo-capture";
import { LocationMap } from "@/components/location-map";
import type { Attendance, AttendanceStatus } from "@/lib/types";
import { pick, type ImportColumn } from "@/lib/xlsx";
import { monthlyAttendanceSummary } from "@/lib/ops";
import { exportRows, timestampedName } from "@/lib/xlsx";
import { toast } from "sonner";

const statuses: AttendanceStatus[] = ["Present", "Absent", "On Leave", "MC", "Half Day", "Off", "Public Holiday", "Pending"];

const ATTENDANCE_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "date", label: "Date", required: true, example: "2026-07-28" },
  { key: "employeeCode", label: "Employee Code", required: true, example: "BSM-0001" },
  { key: "site", label: "Site", example: "Tuas Yard" },
  { key: "status", label: "Status", required: true, example: "Present" },
  { key: "checkIn", label: "Check In", example: "08:00" },
  { key: "checkOut", label: "Check Out", example: "18:00" },
  { key: "hoursWorked", label: "Normal Hours", example: "8" },
  { key: "overtimeHours", label: "OT Hours", example: "2" },
  { key: "notes", label: "Notes", example: "" },
];

export const Route = createFileRoute("/_authenticated/time-management")({
  head: () => ({
    meta: [
      { title: "Time Management — BSM Workforce & Operations" },
      { name: "description", content: "Daily attendance and timesheets." },
      { property: "og:title", content: "Time Management — BSM Workforce & Operations" },
      { property: "og:description", content: "Daily attendance and timesheets." },
    ],
  }),
  component: TimeManagementPage,
});

export default function TimeManagementPage() {
  const [attendance, setAttendance] = useState(getAttendance());
  const [employees] = useState(getEmployees());
  const [sites] = useState(getSites());
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [summaryMonth, setSummaryMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [noLocationOnly, setNoLocationOnly] = useState(false);
  const [mapRecord, setMapRecord] = useState<Attendance | null>(null);
  const companyId = getCurrentCompany();
  const companyEmployees = employees.filter(
    (e) => (!companyId || e.companyId === companyId) && e.status !== "Inactive",
  );

  async function exportMonthlySummary() {
    const rows = monthlyAttendanceSummary(
      attendance,
      summaryMonth,
      companyEmployees.map((e) => e.id),
    ).map((r) => {
      const emp = employees.find((e) => e.id === r.employeeId);
      return {
        "Employee Code": emp?.employeeCode ?? "",
        Name: emp?.name ?? "",
        Month: summaryMonth,
        "Present Days": r.presentDays,
        "Absent / MC": r.absentDays,
        "Leave / Off": r.leaveDays,
        "Normal Hours": r.normalHours,
        "OT Hours": r.otHours,
        "Total Hours": r.totalHours,
      };
    });
    if (!rows.length) {
      toast.error(`No attendance records for ${summaryMonth}`);
      return;
    }
    await exportRows(rows, timestampedName(`timesheet_summary_${summaryMonth}`, "xlsx"), "Summary");
    toast.success("Monthly summary exported");
  }

  const filtered = attendance.filter((a) => {
    const q = search.toLowerCase();
    const emp = employees.find((e) => e.id === a.employeeId);
    const hasLocation = a.checkInLat != null || a.checkOutLat != null;
    if (noLocationOnly && hasLocation) return false;
    return a.date === date && (emp?.name.toLowerCase().includes(q) || emp?.employeeCode.toLowerCase().includes(q));
  });

  const present = filtered.filter((a) => a.status === "Present" || a.status === "Half Day").length;
  const absent = filtered.filter((a) => a.status === "Absent" || a.status === "MC").length;
  const leave = filtered.filter((a) => a.status === "On Leave" || a.status === "Off" || a.status === "Public Holiday").length;
  const totalHours = filtered.reduce((s, a) => s + a.hoursWorked + a.overtimeHours, 0);

  function refresh() {
    setAttendance(getAttendance());
  }

  function attendanceRow(record: (typeof attendance)[number]) {
    const emp = employees.find((e) => e.id === record.employeeId);
    const site = sites.find((s) => s.id === record.siteId);
    return {
      Date: record.date,
      "Employee Code": emp?.employeeCode ?? "",
      Name: emp?.name ?? "",
      FIN: emp?.fin ?? "",
      Site: site?.name ?? "",
      Status: record.status,
      "Check In": record.checkIn ?? "",
      "Check Out": record.checkOut ?? "",
      "Normal Hours": record.hoursWorked,
      "OT Hours": record.overtimeHours,
      "Total Hours": record.hoursWorked + record.overtimeHours,
      Notes: record.notes ?? "",
    };
  }

  function handleImport(rows: Record<string, string>[]) {
    const errors: string[] = [];
    let imported = 0;

    rows.forEach((row, index) => {
      const get = (key: string) =>
        pick(row, ATTENDANCE_IMPORT_COLUMNS.find((c) => c.key === key)!);
      const code = get("employeeCode").toUpperCase();
      const emp = employees.find(
        (e) => e.employeeCode.toUpperCase() === code || e.fin.toUpperCase() === code,
      );
      if (!emp) {
        errors.push(`Row ${index + 2}: employee "${code}" not found`);
        return;
      }
      const rawDate = get("date");
      const parsedDate = new Date(rawDate);
      const day = Number.isNaN(parsedDate.getTime()) ? rawDate : parsedDate.toISOString().slice(0, 10);
      const siteName = get("site").toLowerCase();
      const site = sites.find((s) => s.name.toLowerCase() === siteName);
      const statusValue = get("status").toLowerCase();
      const status = (statuses.find((s) => s.toLowerCase() === statusValue) ??
        "Present") as AttendanceStatus;

      addAttendance({
        employeeId: emp.id,
        date: day,
        siteId: site?.id,
        status,
        checkIn: get("checkIn") || undefined,
        checkOut: get("checkOut") || undefined,
        hoursWorked: Number(get("hoursWorked").replace(/[^0-9.]/g, "")) || 0,
        overtimeHours: Number(get("overtimeHours").replace(/[^0-9.]/g, "")) || 0,
        notes: get("notes") || undefined,
      });
      imported += 1;
    });

    return { imported, errors };
  }

  function handleCreate(formData: FormData) {
    const num = (k: string) => {
      const v = Number(formData.get(k));
      return Number.isFinite(v) && formData.get(k) !== "" ? v : undefined;
    };
    addAttendance({
      employeeId: formData.get("employeeId") as string,
      date: formData.get("date") as string,
      siteId: (formData.get("siteId") as string) || undefined,
      status: formData.get("status") as AttendanceStatus,
      checkIn: (formData.get("checkIn") as string) || undefined,
      checkOut: (formData.get("checkOut") as string) || undefined,
      hoursWorked: Number(formData.get("hoursWorked") || 0),
      overtimeHours: Number(formData.get("overtimeHours") || 0),
      notes: (formData.get("notes") as string) || undefined,
      checkInLat: num("checkInLat"),
      checkInLng: num("checkInLng"),
      checkInAddress: (formData.get("checkInAddress") as string) || undefined,
      checkOutLat: num("checkOutLat"),
      checkOutLng: num("checkOutLng"),
      checkOutAddress: (formData.get("checkOutAddress") as string) || undefined,
    });
    setIsCreateOpen(false);
    refresh();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Time Management</h1>
            <p className="text-sm text-muted-foreground">Daily attendance and timesheet records.</p>
          </div>
          <div className="mt-2 flex gap-2 sm:mt-0">
          <Button size="sm" variant="outline" asChild>
            <Link to="/time-cards">Generate claim sheet</Link>
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Mark attendance
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Mark attendance</DialogTitle>
                <DialogDescription>Record daily attendance for a worker.</DialogDescription>
              </DialogHeader>
              <AttendanceForm employees={employees} sites={sites} onSubmit={handleCreate} />
            </DialogContent>
          </Dialog>
          <div className="mt-2 flex flex-wrap gap-2 sm:mt-0">
            <Dialog open={isSheetOpen} onOpenChange={setIsSheetOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <ClipboardList className="mr-1 h-4 w-4" />
                  Daily sheet
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Daily attendance sheet</DialogTitle>
                  <DialogDescription>Mark every worker for a site in one go.</DialogDescription>
                </DialogHeader>
                <DailySheet
                  employees={companyEmployees}
                  sites={sites}
                  existing={attendance}
                  defaultDate={date}
                  onSaved={(d) => {
                    setDate(d);
                    setIsSheetOpen(false);
                    refresh();
                  }}
                />
              </DialogContent>
            </Dialog>
            <div className="flex items-center gap-1">
              <Input
                type="month"
                value={summaryMonth}
                onChange={(e) => setSummaryMonth(e.target.value)}
                className="h-9 w-36"
              />
              <Button size="sm" variant="outline" onClick={exportMonthlySummary}>
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                Monthly summary
              </Button>
            </div>
            <ImportDialog
              title="Import timesheet"
              description="Upload daily attendance from Excel or CSV. Employees are matched by employee code or FIN."
              templateName="attendance"
              columns={ATTENDANCE_IMPORT_COLUMNS}
              onImport={handleImport}
              onDone={refresh}
            />
            <ExportButton
              rows={filtered.map(attendanceRow)}
              baseName="attendance"
              sheetName="Attendance"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Present" value={present.toString()} icon={<CheckCircle2 className="h-5 w-5" />} variant="success" caption={date} />
          <SummaryCard title="Absent / MC" value={absent.toString()} icon={<AlertCircle className="h-5 w-5" />} variant="destructive" caption={date} />
          <SummaryCard title="Leave / Off" value={leave.toString()} icon={<Clock className="h-5 w-5" />} variant="warning" caption={date} />
          <SummaryCard title="Total hours" value={totalHours.toFixed(1)} icon={<Clock className="h-5 w-5" />} variant="info" caption={date} />
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Search worker..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
              <Button
                type="button"
                size="sm"
                variant={noLocationOnly ? "default" : "outline"}
                onClick={() => setNoLocationOnly((v) => !v)}
              >
                Without location
              </Button>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check in</TableHead>
                  <TableHead>Check out</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>OT</TableHead>
                  <TableHead>Location</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-32 text-center">
                      <EmptyState className="bg-transparent border-0" icon={<Calendar className="h-5 w-5" />} title="No records" description={`No attendance records for ${date}.`} />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((a) => {
                    const emp = employees.find((e) => e.id === a.employeeId);
                    const site = sites.find((s) => s.id === a.siteId);
                    return (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="font-medium">{emp?.name}</div>
                          <div className="text-xs text-muted-foreground">{emp?.employeeCode}</div>
                        </TableCell>
                        <TableCell>{site?.name || "—"}</TableCell>
                        <TableCell>
                          <StatusBadge
                            variant={a.status === "Present" ? "success" : a.status === "Half Day" ? "warning" : a.status === "Absent" || a.status === "MC" ? "destructive" : "info"}
                            label={a.status}
                            dot
                          />
                        </TableCell>
                        <TableCell>{a.checkIn || "—"}</TableCell>
                        <TableCell>{a.checkOut || "—"}</TableCell>
                        <TableCell>{a.hoursWorked}</TableCell>
                        <TableCell>{a.overtimeHours}</TableCell>
                        <TableCell>
                          {a.checkInLat != null || a.checkOutLat != null ? (
                            <Button size="sm" variant="ghost" onClick={() => setMapRecord(a)}>
                              <MapPin className="mr-1 h-3.5 w-3.5" />
                              View
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not captured</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <Dialog open={!!mapRecord} onOpenChange={(open) => !open && setMapRecord(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Attendance location</DialogTitle>
              <DialogDescription>
                {mapRecord
                  ? `${employees.find((e) => e.id === mapRecord.employeeId)?.name ?? ""} — ${mapRecord.date}`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            {mapRecord ? (
              <div className="space-y-2">
                <LocationMap
                  points={[
                    mapRecord.checkInLat != null && mapRecord.checkInLng != null
                      ? { lat: mapRecord.checkInLat, lng: mapRecord.checkInLng, label: `Clock in — ${mapRecord.checkInAddress ?? ""}` }
                      : null,
                    mapRecord.checkOutLat != null && mapRecord.checkOutLng != null
                      ? { lat: mapRecord.checkOutLat, lng: mapRecord.checkOutLng, label: `Clock out — ${mapRecord.checkOutAddress ?? ""}` }
                      : null,
                  ].filter((p): p is { lat: number; lng: number; label: string } => p !== null)}
                />
                <p className="text-xs text-muted-foreground">In: {mapRecord.checkInAddress ?? "—"}</p>
                <p className="text-xs text-muted-foreground">Out: {mapRecord.checkOutAddress ?? "—"}</p>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}

type SheetRow = { status: AttendanceStatus; hours: number; ot: number };

function DailySheet({
  employees,
  sites,
  existing,
  defaultDate,
  onSaved,
}: {
  employees: ReturnType<typeof getEmployees>;
  sites: ReturnType<typeof getSites>;
  existing: Attendance[];
  defaultDate: string;
  onSaved: (date: string) => void;
}) {
  const [sheetDate, setSheetDate] = useState(defaultDate);
  const [siteId, setSiteId] = useState<string>(sites[0]?.id ?? "");
  const [rows, setRows] = useState<Record<string, SheetRow>>({});

  const current = (id: string): SheetRow => {
    if (rows[id]) return rows[id];
    const prev = existing.find((a) => a.employeeId === id && a.date === sheetDate);
    return prev
      ? { status: prev.status, hours: prev.hoursWorked, ot: prev.overtimeHours }
      : { status: "Present", hours: 8, ot: 0 };
  };

  const setRow = (id: string, patch: Partial<SheetRow>) =>
    setRows((r) => ({ ...r, [id]: { ...current(id), ...patch } }));

  function markAll(status: AttendanceStatus) {
    const next: Record<string, SheetRow> = {};
    employees.forEach((e) => {
      next[e.id] = { ...current(e.id), status, hours: status === "Present" ? 8 : 0 };
    });
    setRows(next);
  }

  function save() {
    const payload = employees.map((e) => {
      const row = current(e.id);
      return {
        employeeId: e.id,
        date: sheetDate,
        siteId: siteId || undefined,
        status: row.status,
        hoursWorked: Number(row.hours) || 0,
        overtimeHours: Number(row.ot) || 0,
      };
    });
    const { saved } = saveDailySheet(payload);
    toast.success(`${saved} attendance records saved for ${sheetDate}`);
    onSaved(sheetDate);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Date</Label>
          <Input type="date" value={sheetDate} onChange={(e) => setSheetDate(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label>Site</Label>
          <Select value={siteId} onValueChange={setSiteId}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Select site" />
            </SelectTrigger>
            <SelectContent>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => markAll("Present")}>
            All present
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => markAll("Off")}>
            All off
          </Button>
        </div>
      </div>

      <div className="max-h-[50vh] overflow-y-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead className="w-40">Status</TableHead>
              <TableHead className="w-24">Hours</TableHead>
              <TableHead className="w-24">OT</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                  No active employees in this company.
                </TableCell>
              </TableRow>
            ) : (
              employees.map((e) => {
                const row = current(e.id);
                return (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="font-medium">{e.name}</div>
                      <div className="text-xs text-muted-foreground">{e.employeeCode}</div>
                    </TableCell>
                    <TableCell>
                      <Select value={row.status} onValueChange={(v) => setRow(e.id, { status: v as AttendanceStatus })}>
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.5"
                        className="h-8"
                        value={row.hours}
                        onChange={(ev) => setRow(e.id, { hours: Number(ev.target.value) })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        step="0.5"
                        className="h-8"
                        value={row.ot}
                        onChange={(ev) => setRow(e.id, { ot: Number(ev.target.value) })}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <DialogFooter>
        <Button type="button" onClick={save} disabled={!employees.length}>
          Save sheet
        </Button>
      </DialogFooter>
    </div>
  );
}

function AttendanceForm({ employees, sites, onSubmit }: { employees: ReturnType<typeof getEmployees>; sites: ReturnType<typeof getSites>; onSubmit: (data: FormData) => void }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="employeeId">Employee</Label>
          <Select name="employeeId" defaultValue={employees[0]?.id}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name} ({e.employeeCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" name="date" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="siteId">Site</Label>
          <Select name="siteId">
            <SelectTrigger>
              <SelectValue placeholder="Select site" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">None</SelectItem>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue="Present">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="checkIn">Check in</Label>
          <Input id="checkIn" name="checkIn" type="time" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="checkOut">Check out</Label>
          <Input id="checkOut" name="checkOut" type="time" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hoursWorked">Hours worked</Label>
          <Input id="hoursWorked" name="hoursWorked" type="number" step="0.5" defaultValue={0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="overtimeHours">Overtime</Label>
          <Input id="overtimeHours" name="overtimeHours" type="number" step="0.5" defaultValue={0} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" name="notes" placeholder="Optional notes" />
      </div>
      <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
        <GeoCapture label="Capture clock-in location" prefix="checkIn" />
        <GeoCapture label="Capture clock-out location" prefix="checkOut" />
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Location is optional — if GPS is denied the record is saved and flagged as
          "Location not captured".
        </p>
      </div>
      <DialogFooter>
        <Button type="submit">Save attendance</Button>
      </DialogFooter>
    </form>
  );
}
