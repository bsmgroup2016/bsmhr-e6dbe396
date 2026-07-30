/**
 * Salary compliance panel (Employment Act + EFMA / FWMI): late salary and
 * overtime payment, the 72-hour overtime cap, itemised payslips, declared
 * salary matching and Key Employment Terms coverage.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, BadgeCheck, Download, FileText, Pencil, Timer } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { SummaryCard } from "@/components/ui/summary-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { getPayroll, updateEmployee } from "@/lib/store";
import { exportRows } from "@/lib/xlsx";
import { employeeSlugById } from "@/lib/employee-slug";
import type { Employee, PaymentMethod } from "@/lib/types";
import {
  KET_WINDOW_DAYS, OT_MONTHLY_CAP, ketGaps, salaryComplianceRows, salarySummary,
} from "@/lib/salary-compliance";

const PAY_MODES: PaymentMethod[] = ["Bank Transfer", "GIRO", "PayNow", "Cash", "Cheque"];

const sgd = (n: number) => `$${n.toLocaleString("en-SG", { maximumFractionDigits: 2 })}`;

interface Props {
  employees: Employee[];
  onChanged?: () => void;
}

export function SalaryCompliancePanel({ employees, onChanged }: Props) {
  const payroll = getPayroll();
  const months = useMemo(
    () => Array.from(new Set(payroll.map((p) => p.month))).sort().reverse(),
    [payroll],
  );
  const [month, setMonth] = useState<string>("all");
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<Partial<Employee>>({});

  const rows = useMemo(
    () => salaryComplianceRows(employees, payroll, month === "all" ? undefined : month),
    [employees, payroll, month],
  );
  const summary = useMemo(() => salarySummary(rows), [rows]);
  const ketMissing = useMemo(() => ketGaps(employees), [employees]);

  const openEdit = (employee: Employee) => {
    setEditing(employee);
    setForm({
      declaredSalary: employee.declaredSalary,
      fixedAllowance: employee.fixedAllowance,
      ketIssuedOn: employee.ketIssuedOn,
      salaryPaymentMode: employee.salaryPaymentMode ?? employee.paymentMethod,
    });
  };

  const save = () => {
    if (!editing) return;
    updateEmployee(editing.id, form);
    toast.success(`${editing.name} salary details updated`);
    setEditing(null);
    onChanged?.();
  };

  const exportRowsCsv = () => {
    void exportRows(
      rows.map((r) => ({
        Employee: r.employee.name,
        Code: r.employee.employeeCode,
        Month: r.entry.month,
        "Period end": r.periodEnd,
        "Declared salary": r.declared || "",
        "Paid salary": r.paid,
        "OT hours": r.entry.overtimeHours ?? 0,
        "Paid on": r.entry.paidAt?.slice(0, 10) ?? "",
        "Days after period": r.paidOnDay ?? "",
        Issues: r.issues.map((i) => i.label).join("; ") || "Compliant",
      })),
      "salary-compliance.xlsx",
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Payroll rows checked" value={String(summary.checked)} icon={<FileText className="h-4 w-4" />} />
        <SummaryCard title="Breaches" value={String(summary.critical)} icon={<AlertTriangle className="h-4 w-4" />} variant={summary.critical ? "destructive" : "success"} />
        <SummaryCard title="Late salary / OT" value={String(summary.latePayments)} icon={<Timer className="h-4 w-4" />} variant={summary.latePayments ? "warning" : "success"} />
        <SummaryCard title="KET not issued" value={String(ketMissing.length)} icon={<BadgeCheck className="h-4 w-4" />} variant={ketMissing.length ? "warning" : "success"} />
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Salary payment compliance</h2>
            <p className="text-xs text-muted-foreground">
              Salary within 7 days of the period end, overtime within 14 days and capped at {OT_MONTHLY_CAP} h,
              itemised payslips, and pay not below the salary declared to MOM.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months</SelectItem>
                {months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={exportRowsCsv} disabled={!rows.length}>
              <Download className="mr-1 h-4 w-4" /> Export
            </Button>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Month</TableHead>
                <TableHead>Declared</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead>OT hrs</TableHead>
                <TableHead>Paid on</TableHead>
                <TableHead>Findings</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <EmptyState className="border-0 bg-transparent" icon={<FileText className="h-5 w-5" />} title="No payroll rows" description="Generate payroll to run the salary compliance checks." />
                  </TableCell>
                </TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link to="/workforce/$slug" params={{ slug: employeeSlugById(r.employee.id) }} className="font-medium hover:underline">
                      {r.employee.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{r.employee.employeeCode} · {r.employee.passType}</div>
                  </TableCell>
                  <TableCell className="text-sm">{r.entry.month}</TableCell>
                  <TableCell className="text-sm">{r.declared ? sgd(r.declared) : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm">{sgd(r.paid)}</TableCell>
                  <TableCell className="text-sm">{r.entry.overtimeHours ?? 0}</TableCell>
                  <TableCell className="text-sm">
                    {r.entry.paidAt ? (
                      <>
                        {r.entry.paidAt.slice(0, 10)}
                        <div className="text-xs text-muted-foreground">{r.paidOnDay}d after period</div>
                      </>
                    ) : <span className="text-muted-foreground">Unpaid</span>}
                  </TableCell>
                  <TableCell>
                    {r.issues.length === 0 ? (
                      <StatusBadge variant="success" label="Compliant" />
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {r.issues.map((i) => (
                          <StatusBadge key={i.code} variant={i.severity === "critical" ? "destructive" : "warning"} title={i.detail} label={i.label} />
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r.employee)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-medium">Key Employment Terms (KET)</h2>
        <p className="text-xs text-muted-foreground">
          Written KET must be issued within {KET_WINDOW_DAYS} days of the employee starting work.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ketMissing.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                    Every active employee has KET recorded.
                  </TableCell>
                </TableRow>
              ) : ketMissing.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.name}</TableCell>
                  <TableCell className="text-sm">{e.joinedOn}</TableCell>
                  <TableCell><StatusBadge variant="warning" label="KET not issued" /></TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(e)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salary compliance details</DialogTitle>
            <DialogDescription>{editing?.name} — declared salary, allowances, payment mode and KET.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Declared salary (MOM)</Label>
              <Input
                type="number"
                value={form.declaredSalary ?? ""}
                onChange={(e) => setForm({ ...form, declaredSalary: e.target.value === "" ? undefined : Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Fixed monthly allowance</Label>
              <Input
                type="number"
                value={form.fixedAllowance ?? ""}
                onChange={(e) => setForm({ ...form, fixedAllowance: e.target.value === "" ? undefined : Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Salary payment mode</Label>
              <Select
                value={form.salaryPaymentMode ?? ""}
                onValueChange={(v) => setForm({ ...form, salaryPaymentMode: v as PaymentMethod })}
              >
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {PAY_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>KET issued on</Label>
              <Input
                type="date"
                value={form.ketIssuedOn ?? ""}
                onChange={(e) => setForm({ ...form, ketIssuedOn: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
