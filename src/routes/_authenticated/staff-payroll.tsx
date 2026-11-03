import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Search, Wallet, Clock, CalendarOff, Users } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
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
import { getEmployees, getAttendance, getCurrentCompany } from "@/lib/store";
import { isOfficeStaff } from "@/lib/workforce-split";
import { exportRows, timestampedName } from "@/lib/xlsx";
import { toast } from "sonner";
import { StaffExcelActions } from "@/components/staff-excel-actions";

export const Route = createFileRoute("/_authenticated/staff-payroll")({
  head: () => ({
    meta: [
      { title: "Staff Payroll — BSM Management" },
      { name: "description", content: "Monthly fixed-salary payroll for office staff with absence deductions and OT." },
      { property: "og:title", content: "Staff Payroll — BSM Management" },
      { property: "og:description", content: "Monthly fixed-salary payroll for office staff with absence deductions and OT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StaffPayrollPage,
});

const WORKING_DAYS = 26; // Sundays off

function StaffPayrollPage() {
  const [employees] = useState(getEmployees());
  const [attendance] = useState(getAttendance());
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const companyId = getCurrentCompany();

  const rows = useMemo(() => {
    const staff = employees.filter(
      (e) => isOfficeStaff(e) && (!companyId || e.companyId === companyId) && e.status !== "Inactive",
    );
    return staff
      .map((s) => {
        const recs = attendance.filter((a) => a.employeeId === s.id && a.date.startsWith(month));
        const absentDays = recs.filter((a) => a.status === "Absent").length;
        const presentDays = recs.filter((a) => a.status === "Present" || a.status === "Half Day").length;
        const otHours = recs.reduce((sum, a) => sum + (a.overtimeHours || 0), 0);
        const salary = Number(s.basicSalary || 0);
        const perDay = salary / WORKING_DAYS;
        const deduction = perDay * absentDays;
        const otRate = Number(s.otRate ?? 0) || perDay / 8 * 1.5;
        const otPay = otHours * otRate;
        return {
          id: s.id,
          code: s.employeeCode,
          name: s.name,
          department: s.department || "—",
          designation: s.trade || "—",
          salary,
          presentDays,
          absentDays,
          deduction,
          otHours,
          otPay,
          net: Math.max(0, salary - deduction + otPay),
        };
      })
      .filter(
        (r) =>
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.code.toLowerCase().includes(search.toLowerCase()),
      );
  }, [employees, attendance, companyId, month, search]);

  const totals = useMemo(
    () => ({
      staff: rows.length,
      gross: rows.reduce((s, r) => s + r.salary, 0),
      deduction: rows.reduce((s, r) => s + r.deduction, 0),
      net: rows.reduce((s, r) => s + r.net, 0),
      ot: rows.reduce((s, r) => s + r.otHours, 0),
    }),
    [rows],
  );

  const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const handleExport = async () => {
    try {
    await exportRows(
      rows.map((r) => ({
        "P-File No": r.code,
        Month: month,
        Name: r.name,
        Department: r.department,
        Designation: r.designation,
        "Fixed Salary": r.salary,
        "Present Days": r.presentDays,
        "Absent Days": r.absentDays,
        Deduction: Number(r.deduction.toFixed(2)),
        "OT Hours": r.otHours,
        "OT Pay": Number(r.otPay.toFixed(2)),
        "Net Pay": Number(r.net.toFixed(2)),
      })),
      timestampedName(`staff_payroll_${month}`, "xlsx"),
      "Staff Payroll",
    );
    toast.success("Staff payroll exported");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Excel export failed"); }
  };

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Staff Payroll</h1>
            <p className="text-sm text-muted-foreground">
              Monthly fixed salary for office staff — absent days deducted at salary / {WORKING_DAYS} days, OT added on top.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
            <StaffExcelActions section="payroll" onExport={handleExport} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard title="Staff on payroll" value={String(totals.staff)} icon={<Users className="h-5 w-5" />} />
          <SummaryCard title="Gross monthly" value={money(totals.gross)} icon={<Wallet className="h-5 w-5" />} />
          <SummaryCard title="Absence deduction" value={money(totals.deduction)} icon={<CalendarOff className="h-5 w-5" />} variant="destructive" />
          <SummaryCard title="Net payable" value={money(totals.net)} icon={<Clock className="h-5 w-5" />} variant="success" />
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name or P-File No"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>P-File No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Fixed salary</TableHead>
                <TableHead className="text-right">Present</TableHead>
                <TableHead className="text-right">Absent</TableHead>
                <TableHead className="text-right">Deduction</TableHead>
                <TableHead className="text-right">OT hrs</TableHead>
                <TableHead className="text-right">OT pay</TableHead>
                <TableHead className="text-right">Net pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-muted-foreground">{r.department}</TableCell>
                  <TableCell className="text-right">{money(r.salary)}</TableCell>
                  <TableCell className="text-right">{r.presentDays}</TableCell>
                  <TableCell className="text-right">{r.absentDays}</TableCell>
                  <TableCell className="text-right text-destructive">{money(r.deduction)}</TableCell>
                  <TableCell className="text-right">{r.otHours}</TableCell>
                  <TableCell className="text-right">{money(r.otPay)}</TableCell>
                  <TableCell className="text-right font-semibold">{money(r.net)}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                    No office staff found for this filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppShell>
  );
}
