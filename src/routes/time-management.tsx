import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
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
import { getEmployees, getSites, getAttendance, addAttendance } from "@/lib/store";
import type { Attendance, AttendanceStatus } from "@/lib/types";

const statuses: AttendanceStatus[] = ["Present", "Absent", "On Leave", "MC", "Half Day", "Off", "Public Holiday", "Pending"];

export const Route = createFileRoute("/time-management")({
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

  const filtered = attendance.filter((a) => {
    const q = search.toLowerCase();
    const emp = employees.find((e) => e.id === a.employeeId);
    return a.date === date && (emp?.name.toLowerCase().includes(q) || emp?.employeeCode.toLowerCase().includes(q));
  });

  const present = filtered.filter((a) => a.status === "Present" || a.status === "Half Day").length;
  const absent = filtered.filter((a) => a.status === "Absent" || a.status === "MC").length;
  const leave = filtered.filter((a) => a.status === "On Leave" || a.status === "Off" || a.status === "Public Holiday").length;
  const totalHours = filtered.reduce((s, a) => s + a.hoursWorked + a.overtimeHours, 0);

  function refresh() {
    setAttendance(getAttendance());
  }

  function handleCreate(formData: FormData) {
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
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="mt-2 sm:mt-0">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center">
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
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </AppShell>
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
      <DialogFooter>
        <Button type="submit">Save attendance</Button>
      </DialogFooter>
    </form>
  );
}
