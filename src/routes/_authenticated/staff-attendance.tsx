import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  Calendar,
  Clock,
  Search,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Filter,
  Info,
  Coffee,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getEmployees, getAttendance, getCurrentCompany, getLeaveRequests } from "@/lib/store";
import { isOfficeStaff } from "@/lib/workforce-split";
import { exportRows, timestampedName } from "@/lib/xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/staff-attendance")({
  head: () => ({
    meta: [
      { title: "Staff Attendance — BSM Management" },
      { name: "description", content: "Office staff daily attendance tracking." },
    ],
  }),
  component: StaffAttendancePage,
});

function StaffAttendancePage() {
  const [attendance] = useState(getAttendance());
  const [employees] = useState(getEmployees());
  const [leaveRequests] = useState(getLeaveRequests());
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [deptFilter, setDeptFilter] = useState("All");
  
  const companyId = getCurrentCompany();

  // Office hours configuration
  const OFFICE_START = "09:00";
  const OFFICE_END = "18:00";
  const LUNCH_START = "12:00";
  const LUNCH_END = "13:00";

  // Filter staff only
  const staff = useMemo(() => {
    return employees.filter(e => 
      isOfficeStaff(e) && 
      (!companyId || e.companyId === companyId) &&
      e.status !== "Inactive"
    );
  }, [employees, companyId]);

  const departments = useMemo(() => {
    const depts = new Set(staff.map(s => s.department).filter(Boolean));
    return ["All", ...Array.from(depts)] as string[];
  }, [staff]);

  const filteredAttendance = useMemo(() => {
    return staff.map(s => {
      const record = attendance.find(a => a.employeeId === s.id && a.date === date);
      const isSunday = new Date(date).getDay() === 0;
      
      // Auto-status for Sunday
      let status = record?.status || "Pending";
      if (!record && isSunday) status = "Off";

      // Check if on leave
      const leave = leaveRequests.find(l => 
        l.employeeId === s.id && 
        l.status === "Approved" && 
        date >= l.startDate && 
        date <= l.endDate
      );
      if (leave) status = "On Leave";

      return {
        staff: s,
        record: record || {
          status: status as any,
          checkIn: null,
          checkOut: null,
          hoursWorked: 0,
        }
      };
    }).filter(item => {
      const matchesSearch = 
        item.staff.name.toLowerCase().includes(search.toLowerCase()) ||
        item.staff.employeeCode.toLowerCase().includes(search.toLowerCase());
      const matchesDept = deptFilter === "All" || item.staff.department === deptFilter;
      return matchesSearch && matchesDept;
    });
  }, [staff, attendance, date, search, deptFilter, leaveRequests]);

  const stats = useMemo(() => {
    const present = filteredAttendance.filter(i => i.record.status === "Present").length;
    const absent = filteredAttendance.filter(i => i.record.status === "Absent" || i.record.status === "MC").length;
    const pending = filteredAttendance.filter(i => i.record.status === "Pending").length;
    return { present, absent, pending };
  }, [filteredAttendance]);

  const handleExport = async () => {
    const rows = filteredAttendance.map(item => ({
      "Employee ID": item.staff.employeeCode,
      "Name": item.staff.name,
      "Department": item.staff.department || "—",
      "Status": item.record.status,
      "Check In": item.record.checkIn || "—",
      "Check Out": item.record.checkOut || "—",
    }));
    await exportRows(rows, timestampedName(`staff_attendance_${date}`, "xlsx"), "Staff");
    toast.success("Attendance report exported");
  };

  const notifyLunch = (type: 'start' | 'end') => {
    const time = type === 'start' ? LUNCH_START : LUNCH_END;
    const msg = type === 'start' 
      ? `এটি দুপুর ${time}টা, দুপুরের খাবারের সময় শুরু হয়েছে।` 
      : `দুপুর ${time}টা বেজেছে, দুপুরের খাবারের সময় শেষ হয়েছে।`;
    
    toast.info(msg, {
      icon: <Coffee className="h-4 w-4" />,
      duration: 5000,
    });
  };

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Staff Attendance</h1>
            <p className="text-sm text-muted-foreground">Office staff daily attendance, office hours, and monthly basic tracking.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className="w-40"
            />
            <Button size="sm" variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <Alert className="bg-primary/5 border-primary/20">
          <Info className="h-4 w-4 text-primary" />
          <AlertTitle>Office Hours & Policy</AlertTitle>
          <AlertDescription className="text-xs">
            Office Hours: {OFFICE_START} - {OFFICE_END} | Lunch: {LUNCH_START} - {LUNCH_END} (1h) | Sundays are automatically marked as Off.
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => notifyLunch('start')}>Test Lunch Start Notification</Button>
              <Button size="sm" variant="secondary" onClick={() => notifyLunch('end')}>Test Lunch End Notification</Button>
            </div>
          </AlertDescription>
        </Alert>

        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard 
            title="Present" 
            value={stats.present.toString()} 
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
            variant="success"
          />
          <SummaryCard 
            title="Absent / MC" 
            value={stats.absent.toString()} 
            icon={<AlertCircle className="h-5 w-5 text-red-500" />}
            variant="destructive"
          />
          <SummaryCard 
            title="Pending" 
            value={stats.pending.toString()} 
            icon={<Clock className="h-5 w-5 text-amber-500" />}
            variant="warning"
          />
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search staff name or ID..." 
                className="pl-9" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead>OT Hours</TableHead>
                  <TableHead>Late</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttendance.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      No staff records found for this criteria.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAttendance.map(({ staff, record }) => {
                    const isLate = record.checkIn && record.checkIn > OFFICE_START;
                    const otHours = record.checkOut && record.checkOut > OFFICE_END 
                      ? (new Date(`1970-01-01T${record.checkOut}`).getTime() - new Date(`1970-01-01T${OFFICE_END}`).getTime()) / 3600000 
                      : 0;
                    
                    return (
                      <TableRow key={staff.id}>
                        <TableCell>
                          <div className="font-medium">{staff.name}</div>
                          <div className="text-xs text-muted-foreground">{staff.employeeCode}</div>
                        </TableCell>
                        <TableCell>{staff.department || "—"}</TableCell>
                        <TableCell>
                          <StatusBadge 
                            variant={
                              record.status === "Present" ? "success" : 
                              record.status === "Pending" ? "warning" : 
                              record.status === "Off" ? "info" :
                              "destructive"
                            }
                            label={record.status}
                            dot
                          />
                        </TableCell>
                        <TableCell className={isLate ? "text-amber-600 font-medium" : ""}>
                          {record.checkIn || "—"}
                        </TableCell>
                        <TableCell>{record.checkOut || "—"}</TableCell>
                        <TableCell>{otHours > 0 ? `${otHours.toFixed(1)}h` : "—"}</TableCell>
                        <TableCell>
                          {isLate ? (
                            <span className="text-xs text-amber-600 flex items-center">
                              <Bell className="h-3 w-3 mr-1" /> Late
                            </span>
                          ) : "—"}
                        </TableCell>
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
