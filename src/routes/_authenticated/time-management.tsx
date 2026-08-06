import { useMemo, useState } from "react";
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
  Download,
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
import {
  getEmployees,
  getSites,
  getAttendance,
  addAttendance,
  updateAttendance,
  deleteAttendance,
  saveDailySheet,
  getCurrentCompany,
  getCompanies,
} from "@/lib/store";
import { isSiteWorker } from "@/lib/workforce-split";
import { GeoCapture } from "@/components/geo-capture";
import { QrAttendancePanel } from "@/components/qr-attendance-panel";
import { PunchVerificationPanel } from "@/components/punch-verification-panel";
import { LocationMap } from "@/components/location-map";
import type { Attendance, AttendanceStatus } from "@/lib/types";
import { pick, type ImportColumn } from "@/lib/xlsx";
import { monthlyAttendanceSummary } from "@/lib/ops";
import { exportRows, timestampedName } from "@/lib/xlsx";
import { toast } from "sonner";

const statuses: AttendanceStatus[] = ["Present", "Absent", "On Leave", "MC", "Half Day", "Off", "Public Holiday", "Pending"];

const ATTENDANCE_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "date", label: "Date", required: true, example: "2026-07-28" },
  { key: "employeeCode", label: "P-File Number", required: true, example: "BSM-0001" },
  { key: "site", label: "Site", example: "Tuas Yard" },
  { key: "status", label: "Status", required: true, example: "Present" },
  { key: "checkIn", label: "Check In", example: "08:00" },
  { key: "checkOut", label: "Check Out", example: "18:00" },
  { key: "hoursWorked", label: "Normal Hours", example: "8" },
  { key: "overtimeHours", label: "OT Hours", example: "2" },
  { key: "notes", label: "Notes", example: "" },
];

export const Route = createFileRoute("/_authenticated/time-management")({
  validateSearch: (search: Record<string, unknown>): { new?: true } => ({
    new: search.new === "1" || search.new === true ? true : undefined,
  }),
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
  const [isCreateOpen, setIsCreateOpen] = useState(Route.useSearch().new === true);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [summaryMonth, setSummaryMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [noLocationOnly, setNoLocationOnly] = useState(false);
  const [mapRecord, setMapRecord] = useState<Attendance | null>(null);
  const [editRecord, setEditRecord] = useState<Attendance | null>(null);
  const companyId = getCurrentCompany();
  const companies = getCompanies();
  const [companyFilter, setCompanyFilter] = useState<string>(companyId || "all");
  const [groupFilter, setGroupFilter] = useState<"all" | "workers" | "staff">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [designationFilter, setDesignationFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"day" | "month">("day");
  const companyEmployees = employees.filter(
    (e) => (!companyId || e.companyId === companyId) && e.status !== "Inactive",
  );

  const empById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const designations = useMemo(
    () => [...new Set(employees.map((e) => e.trade).filter(Boolean) as string[])].sort(),
    [employees],
  );

  /** Employee dropdown options, scoped to company / group / designation. */
  const employeeOptions = useMemo(
    () =>
      employees
        .filter((e) => companyFilter === "all" || e.companyId === companyFilter)
        .filter((e) => groupFilter === "all" || (groupFilter === "workers" ? isSiteWorker(e) : !isSiteWorker(e)))
        .filter((e) => designationFilter === "all" || e.trade === designationFilter)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [employees, companyFilter, groupFilter, designationFilter],
  );

  /** Shared people filter (company / worker-staff / designation / search). */
  const matchesPerson = (employeeId: string) => {
    const emp = empById.get(employeeId);
    if (!emp) return false;
    if (companyFilter !== "all" && emp.companyId !== companyFilter) return false;
    if (groupFilter === "workers" && !isSiteWorker(emp)) return false;
    if (groupFilter === "staff" && isSiteWorker(emp)) return false;
    if (designationFilter !== "all" && emp.trade !== designationFilter) return false;
    if (employeeFilter !== "all" && emp.id !== employeeFilter) return false;
    const q = search.trim().toLowerCase();
    if (
      q &&
      !emp.name.toLowerCase().includes(q) &&
      !emp.employeeCode.toLowerCase().includes(q)
    )
      return false;
    return true;
  };

  const scopedEmployeeIds = useMemo(
    () => employees.filter((e) => matchesPerson(e.id)).map((e) => e.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employees, companyFilter, groupFilter, designationFilter, employeeFilter, search],
  );

  const monthRows = useMemo(
    () =>
      viewMode === "month"
        ? monthlyAttendanceSummary(attendance, summaryMonth, scopedEmployeeIds).sort((a, b) =>
            (empById.get(a.employeeId)?.employeeCode ?? "").localeCompare(
              empById.get(b.employeeId)?.employeeCode ?? "",
            ),
          )
        : [],
    [viewMode, attendance, summaryMonth, scopedEmployeeIds, empById],
  );

  async function exportMonthlySummary() {
    const rows = monthlyAttendanceSummary(
      attendance,
      summaryMonth,
      companyEmployees.map((e) => e.id),
    ).map((r) => {
      const emp = employees.find((e) => e.id === r.employeeId);
      return {
        "P-File Number": emp?.employeeCode ?? "",
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
    const hasLocation = a.checkInLat != null || a.checkOutLat != null;
    if (noLocationOnly && hasLocation) return false;
    if (a.date !== date) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return matchesPerson(a.employeeId);
  });

  const present = filtered.filter((a) => a.status === "Present" || a.status === "Half Day").length;
  const absent = filtered.filter((a) => a.status === "Absent" || a.status === "MC").length;
  const leave = filtered.filter((a) => a.status === "On Leave" || a.status === "Off" || a.status === "Public Holiday").length;
  const totalHours = filtered.reduce((s, a) => s + a.hoursWorked + a.overtimeHours, 0);

  function refresh() {
    setAttendance(getAttendance());
  }

  /** Download one attendance record as XLSX. */
  async function exportSingle(record: Attendance) {
    const emp = empById.get(record.employeeId);
    await exportRows(
      [attendanceRow(record)],
      timestampedName(`attendance_${emp?.employeeCode ?? "record"}_${record.date}`, "xlsx"),
      "Attendance",
    );
    toast.success("Record downloaded");
  }

  /** Download every daily record of one employee for the selected month. */
  async function exportEmployeeMonth(employeeId: string) {
    const emp = empById.get(employeeId);
    const rows = attendance
      .filter((a) => a.employeeId === employeeId && a.date.startsWith(summaryMonth))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(attendanceRow);
    if (!rows.length) {
      toast.error(`No records for ${emp?.name ?? "employee"} in ${summaryMonth}`);
      return;
    }
    await exportRows(
      rows,
      timestampedName(`attendance_${emp?.employeeCode ?? "employee"}_${summaryMonth}`, "xlsx"),
      "Attendance",
    );
    toast.success("Attendance downloaded");
  }

  /** Bulk download: all daily records of the filtered employees for the month. */
  async function exportMonthlyDetail() {
    const ids = new Set(scopedEmployeeIds);
    const rows = attendance
      .filter((a) => ids.has(a.employeeId) && a.date.startsWith(summaryMonth))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(attendanceRow);
    if (!rows.length) {
      toast.error(`No attendance records for ${summaryMonth}`);
      return;
    }
    await exportRows(rows, timestampedName(`attendance_detail_${summaryMonth}`, "xlsx"), "Attendance");
    toast.success(`${rows.length} records exported`);
  }

  function handleEdit(formData: FormData) {
    if (!editRecord) return;
    const num = (k: string) => {
      const v = Number(formData.get(k));
      return Number.isFinite(v) && formData.get(k) !== "" ? v : undefined;
    };
    updateAttendance(editRecord.id, {
      employeeId: formData.get("employeeId") as string,
      date: formData.get("date") as string,
      siteId: (formData.get("siteId") as string) || undefined,
      status: formData.get("status") as AttendanceStatus,
      checkIn: (formData.get("checkIn") as string) || undefined,
      checkOut: (formData.get("checkOut") as string) || undefined,
      hoursWorked: Number(formData.get("hoursWorked") || 0),
      overtimeHours: Number(formData.get("overtimeHours") || 0),
      notes: (formData.get("notes") as string) || undefined,
      checkInLat: num("checkInLat") ?? editRecord.checkInLat,
      checkInLng: num("checkInLng") ?? editRecord.checkInLng,
      checkOutLat: num("checkOutLat") ?? editRecord.checkOutLat,
      checkOutLng: num("checkOutLng") ?? editRecord.checkOutLng,
    });
    setEditRecord(null);
    refresh();
    toast.success("Attendance updated");
  }

  function handleDelete(record: Attendance) {
    if (!window.confirm("Delete this attendance record?")) return;
    deleteAttendance(record.id);
    refresh();
    toast.success("Record deleted");
  }

  function attendanceRow(record: (typeof attendance)[number]) {
    const emp = employees.find((e) => e.id === record.employeeId);
    const site = sites.find((s) => s.id === record.siteId);
    return {
      Date: record.date,
      "P-File Number": emp?.employeeCode ?? "",
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
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Time Management</h1>
            <p className="text-sm text-muted-foreground">Daily attendance and timesheet records.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/60 p-2 shadow-sm backdrop-blur">
            <Input
              type="month"
              value={summaryMonth}
              onChange={(e) => setSummaryMonth(e.target.value)}
              className="h-9 w-[130px]"
              aria-label="Report month"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <FileSpreadsheet className="mr-1 h-4 w-4" />
                  Reports
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={exportMonthlySummary}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Monthly summary
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportMonthlyDetail}>
                  <Download className="mr-2 h-4 w-4" />
                  Monthly detail (bulk)
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/time-cards">
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Generate claim sheet
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="hidden h-6 w-px bg-border sm:block" />
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
            <ImportDialog
              title="Import timesheet"
              description="Upload daily attendance from Excel or CSV. Employees are matched by P-File number or FIN."
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
          </div>
        </div>

        {(() => {
          const isMonth = viewMode === "month";
          const caption = isMonth ? summaryMonth : date;
          const mPresent = monthRows.reduce((s, r) => s + r.presentDays, 0);
          const mAbsent = monthRows.reduce((s, r) => s + r.absentDays, 0);
          const mLeave = monthRows.reduce((s, r) => s + r.leaveDays, 0);
          const mHours = monthRows.reduce((s, r) => s + r.totalHours, 0);
          const mOt = monthRows.reduce((s, r) => s + r.otHours, 0);
          const ot = filtered.reduce((s, a) => s + a.overtimeHours, 0);
          return (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <SummaryCard title={isMonth ? "Present days" : "Present"} value={String(isMonth ? mPresent : present)} icon={<CheckCircle2 className="h-5 w-5" />} variant="success" caption={caption} />
              <SummaryCard title="Absent / MC" value={String(isMonth ? mAbsent : absent)} icon={<AlertCircle className="h-5 w-5" />} variant="destructive" caption={caption} />
              <SummaryCard title="Leave / Off" value={String(isMonth ? mLeave : leave)} icon={<Clock className="h-5 w-5" />} variant="warning" caption={caption} />
              <SummaryCard title="OT hours" value={(isMonth ? mOt : ot).toFixed(1)} icon={<Clock className="h-5 w-5" />} variant="warning" caption={caption} />
              <SummaryCard title="Total hours" value={(isMonth ? mHours : totalHours).toFixed(1)} icon={<Clock className="h-5 w-5" />} variant="info" caption={caption} />
            </div>
          );
        })()}

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Employee name / P-File No..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {viewMode === "day" ? (
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
              ) : (
                <Input
                  type="month"
                  value={summaryMonth}
                  onChange={(e) => setSummaryMonth(e.target.value)}
                  className="w-40"
                />
              )}
              <Select value={viewMode} onValueChange={(v) => setViewMode(v as "day" | "month")}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Daily view</SelectItem>
                  <SelectItem value="month">Monthly view</SelectItem>
                </SelectContent>
              </Select>
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

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {employeeOptions.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} · {e.employeeCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
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
            <Select value={groupFilter} onValueChange={(v) => setGroupFilter(v as typeof groupFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="workers">Site workers</SelectItem>
                <SelectItem value="staff">Office staff</SelectItem>
              </SelectContent>
            </Select>
            <Select value={designationFilter} onValueChange={setDesignationFilter}>
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
            {viewMode === "day" ? (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <span className="ml-auto text-xs text-muted-foreground">
              {viewMode === "day"
                ? `${filtered.length} records`
                : `${monthRows.length} employees`}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setCompanyFilter("all");
                setGroupFilter("all");
                setDesignationFilter("all");
                setStatusFilter("all");
                setEmployeeFilter("all");
                setSearch("");
              }}
            >
              Clear filters
            </Button>
          </div>

          {viewMode === "month" ? (
            <div className="mt-4 overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead className="text-right">Present</TableHead>
                    <TableHead className="text-right">Absent / MC</TableHead>
                    <TableHead className="text-right">Leave / Off</TableHead>
                    <TableHead className="text-right">Normal hrs</TableHead>
                    <TableHead className="text-right">OT hrs</TableHead>
                    <TableHead className="text-right">Total hrs</TableHead>
                    <TableHead className="w-20 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center">
                        <EmptyState
                          className="border-0 bg-transparent"
                          icon={<Calendar className="h-5 w-5" />}
                          title="No records"
                          description={`No attendance records for ${summaryMonth}.`}
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    monthRows.map((r) => {
                      const emp = empById.get(r.employeeId);
                      return (
                        <TableRow key={r.employeeId}>
                          <TableCell>
                            <div className="font-medium">{emp?.name}</div>
                            <div className="text-xs text-muted-foreground">{emp?.employeeCode}</div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{emp?.trade || "—"}</TableCell>
                          <TableCell className="text-right">{r.presentDays}</TableCell>
                          <TableCell className="text-right">{r.absentDays}</TableCell>
                          <TableCell className="text-right">{r.leaveDays}</TableCell>
                          <TableCell className="text-right">{r.normalHours}</TableCell>
                          <TableCell className="text-right">{r.otHours}</TableCell>
                          <TableCell className="text-right font-semibold">{r.totalHours}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              title={`Download ${summaryMonth} attendance`}
                              onClick={() => exportEmployeeMonth(r.employeeId)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
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
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center">
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
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditRecord(a)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => exportSingle(a)}>
                                <Download className="mr-2 h-4 w-4" />
                                Download record
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => exportEmployeeMonth(a.employeeId)}>
                                <FileSpreadsheet className="mr-2 h-4 w-4" />
                                Download month ({summaryMonth})
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDelete(a)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3">
            <h2 className="text-base font-semibold">QR site attendance</h2>
            <p className="text-sm text-muted-foreground">
              Print a per-site QR poster — workers scan it to clock in and out with GPS evidence.
            </p>
          </div>
          <QrAttendancePanel />
        </div>

        <PunchVerificationPanel />

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

        <Dialog open={!!editRecord} onOpenChange={(open) => !open && setEditRecord(null)}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Edit attendance</DialogTitle>
              <DialogDescription>
                {editRecord
                  ? `${empById.get(editRecord.employeeId)?.name ?? ""} — ${editRecord.date}`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            {editRecord ? (
              <AttendanceForm
                employees={employees}
                sites={sites}
                record={editRecord}
                onSubmit={handleEdit}
              />
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

function AttendanceForm({ employees, sites, onSubmit, record }: { employees: ReturnType<typeof getEmployees>; sites: ReturnType<typeof getSites>; onSubmit: (data: FormData) => void; record?: Attendance }) {
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
          <Select name="employeeId" defaultValue={record?.employeeId ?? employees[0]?.id}>
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
          <Input id="date" name="date" type="date" defaultValue={record?.date ?? new Date().toISOString().split("T")[0]} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="siteId">Site</Label>
          <Select name="siteId" defaultValue={record?.siteId}>
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
          <Select name="status" defaultValue={record?.status ?? "Present"}>
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
          <Input id="checkIn" name="checkIn" type="time" defaultValue={record?.checkIn ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="checkOut">Check out</Label>
          <Input id="checkOut" name="checkOut" type="time" defaultValue={record?.checkOut ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="hoursWorked">Hours worked</Label>
          <Input id="hoursWorked" name="hoursWorked" type="number" step="0.5" defaultValue={record?.hoursWorked ?? 0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="overtimeHours">Overtime</Label>
          <Input id="overtimeHours" name="overtimeHours" type="number" step="0.5" defaultValue={record?.overtimeHours ?? 0} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" name="notes" placeholder="Optional notes" defaultValue={record?.notes ?? ""} />
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
        <Button type="submit">{record ? "Update attendance" : "Save attendance"}</Button>
      </DialogFooter>
    </form>
  );
}
