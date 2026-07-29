import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  DollarSign,
  CheckCircle2,
  Clock,
  Wand2,
  Printer,
  Trash2,
  Building2,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getEmployees,
  getPayroll,
  addPayroll,
  updatePayroll,
  deletePayroll,
  generatePayrollForMonth,
  getCompanies,
  getCurrentCompany,
  getCurrentUser,
} from "@/lib/store";
import { toast } from "sonner";
import type { Employee, PayrollEntry, PayrollStatus } from "@/lib/types";
import { pick, type ImportColumn } from "@/lib/xlsx";

const statuses: PayrollStatus[] = ["Draft", "Pending Approval", "Approved", "Paid", "Rejected"];

const PAYROLL_IMPORT_COLUMNS: ImportColumn[] = [
  { key: "employeeCode", label: "Employee Code", required: true, example: "BSM-0001" },
  { key: "month", label: "Month", required: true, example: "2026-07" },
  { key: "basicSalary", label: "Basic Salary", required: true, example: "1400" },
  { key: "overtimePay", label: "Overtime Pay", example: "220" },
  { key: "allowances", label: "Allowances", example: "100" },
  { key: "deductions", label: "Deductions", example: "50" },
  { key: "cpfEmployee", label: "CPF Employee", example: "0" },
  { key: "cpfEmployer", label: "CPF Employer", example: "0" },
  { key: "levies", label: "Levies", example: "300" },
  { key: "status", label: "Status", example: "Draft" },
];

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({
    meta: [
      { title: "Payroll — BSM Workforce & Operations" },
      { name: "description", content: "Monthly payroll and payslip management." },
      { property: "og:title", content: "Payroll — BSM Workforce & Operations" },
      { property: "og:description", content: "Monthly payroll and payslip management." },
    ],
  }),
  component: PayrollPage,
});

export default function PayrollPage() {
  const [payroll, setPayroll] = useState(getPayroll());
  const [employees] = useState(getEmployees());
  const [companies] = useState(getCompanies());
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState<PayrollStatus | "all">("all");
  const [companyFilter, setCompanyFilter] = useState<string>(getCurrentCompany() || "all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [payslipOf, setPayslipOf] = useState<PayrollEntry | null>(null);

  const filtered = payroll.filter((p) => {
    const q = search.toLowerCase();
    const emp = employees.find((e) => e.id === p.employeeId);
    const matchesCompany = companyFilter === "all" || emp?.companyId === companyFilter;
    const matchesSearch =
      !q || emp?.name.toLowerCase().includes(q) || emp?.employeeCode.toLowerCase().includes(q);
    return (
      p.month === month &&
      matchesCompany &&
      matchesSearch &&
      (statusFilter === "all" || p.status === statusFilter)
    );
  });

  const totalNetPay = filtered.reduce((s, p) => s + p.netPay, 0);
  const totalLevies = filtered.reduce((s, p) => s + p.levies, 0);
  const paidCount = filtered.filter((p) => p.status === "Paid").length;
  const pendingCount = filtered.filter((p) => p.status === "Pending Approval" || p.status === "Draft").length;

  function refresh() {
    setPayroll(getPayroll());
  }

  function handleGenerate() {
    const { created, skipped } = generatePayrollForMonth(
      month,
      companyFilter === "all" ? undefined : companyFilter,
    );
    refresh();
    toast.success(`${created} payroll draft created`, {
      description: skipped ? `${skipped} already existed for ${month}.` : `Month ${month}.`,
    });
  }

  function setStatus(entry: PayrollEntry, status: PayrollStatus) {
    const user = getCurrentUser();
    updatePayroll(entry.id, {
      status,
      approvedBy: status === "Approved" ? user?.id : entry.approvedBy,
      approvedAt: status === "Approved" ? new Date().toISOString() : entry.approvedAt,
      paidAt: status === "Paid" ? new Date().toISOString() : entry.paidAt,
    });
    refresh();
    toast.success(`Marked as ${status}`);
  }

  function handleDelete(entry: PayrollEntry) {
    deletePayroll(entry.id);
    refresh();
    toast.success("Payroll entry deleted");
  }

  function payrollRow(entry: PayrollEntry) {
    const emp = employees.find((e) => e.id === entry.employeeId);
    return {
      Month: entry.month,
      "Employee Code": emp?.employeeCode ?? "",
      Name: emp?.name ?? "",
      FIN: emp?.fin ?? "",
      "Basic Salary": entry.basicSalary,
      "Overtime Pay": entry.overtimePay,
      Allowances: entry.allowances,
      Deductions: entry.deductions,
      "CPF Employee": entry.cpfEmployee,
      "CPF Employer": entry.cpfEmployer,
      Levies: entry.levies,
      "Net Pay": entry.netPay,
      Status: entry.status,
    };
  }

  function handleImport(rows: Record<string, string>[]) {
    const errors: string[] = [];
    let imported = 0;
    const num = (value: string) => Number(value.replace(/[^0-9.-]/g, "")) || 0;

    rows.forEach((row, index) => {
      const get = (key: string) => pick(row, PAYROLL_IMPORT_COLUMNS.find((c) => c.key === key)!);
      const code = get("employeeCode").toUpperCase();
      const emp = employees.find(
        (e) => e.employeeCode.toUpperCase() === code || e.fin.toUpperCase() === code,
      );
      if (!emp) {
        errors.push(`Row ${index + 2}: employee "${code}" not found`);
        return;
      }
      const basicSalary = num(get("basicSalary"));
      const overtimePay = num(get("overtimePay"));
      const allowances = num(get("allowances"));
      const deductions = num(get("deductions"));
      const cpfEmployee = num(get("cpfEmployee"));
      const levies = num(get("levies"));
      const statusValue = get("status").toLowerCase();

      addPayroll({
        employeeId: emp.id,
        month: get("month").slice(0, 7),
        basicSalary,
        overtimePay,
        allowances,
        deductions,
        cpfEmployee,
        cpfEmployer: num(get("cpfEmployer")),
        levies,
        netPay: basicSalary + overtimePay + allowances - deductions - cpfEmployee,
        status: (statuses.find((s) => s.toLowerCase() === statusValue) ?? "Draft") as PayrollStatus,
      });
      imported += 1;
    });

    return { imported, errors };
  }

  function handleCreate(formData: FormData) {
    const basicSalary = Number(formData.get("basicSalary") || 0);
    const overtimePay = Number(formData.get("overtimePay") || 0);
    const allowances = Number(formData.get("allowances") || 0);
    const deductions = Number(formData.get("deductions") || 0);
    const cpfEmployee = Number(formData.get("cpfEmployee") || 0);
    const levies = Number(formData.get("levies") || 0);
    const netPay = basicSalary + overtimePay + allowances - deductions - cpfEmployee;
    addPayroll({
      employeeId: formData.get("employeeId") as string,
      month: formData.get("month") as string,
      basicSalary,
      overtimePay,
      allowances,
      deductions,
      cpfEmployee,
      cpfEmployer: Number(formData.get("cpfEmployer") || 0),
      levies,
      netPay,
      status: formData.get("status") as PayrollStatus,
    });
    setIsCreateOpen(false);
    refresh();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Payroll</h1>
            <p className="text-sm text-muted-foreground">Monthly payroll and payslip management.</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleGenerate}>
              <Wand2 className="mr-1 h-4 w-4" />
              Generate {month}
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Add entry
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>Add payroll entry</DialogTitle>
                  <DialogDescription>Enter salary and deductions.</DialogDescription>
                </DialogHeader>
                <PayrollForm employees={employees} onSubmit={handleCreate} />
              </DialogContent>
            </Dialog>
            <ImportDialog
              title="Import payroll"
              description="Upload a monthly payroll sheet. Net pay is recalculated from the imported figures."
              templateName="payroll"
              columns={PAYROLL_IMPORT_COLUMNS}
              onImport={handleImport}
              onDone={refresh}
            />
            <ExportButton rows={filtered.map(payrollRow)} baseName="payroll" sheetName="Payroll" />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Net pay" value={`S$${totalNetPay.toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} variant="primary" caption={month} />
          <SummaryCard title="Levies" value={`S$${totalLevies.toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} variant="warning" caption={month} />
          <SummaryCard title="Paid" value={paidCount.toString()} icon={<CheckCircle2 className="h-5 w-5" />} variant="success" caption={month} />
          <SummaryCard title="Pending" value={pendingCount.toString()} icon={<Clock className="h-5 w-5" />} variant="info" caption={month} />
        </div>

        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Search worker..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-2">
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="w-44">
                  <Building2 className="mr-1 h-4 w-4 text-muted-foreground" />
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
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as PayrollStatus | "all")}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Basic</TableHead>
                  <TableHead>OT</TableHead>
                  <TableHead>Allowances</TableHead>
                  <TableHead>Deductions</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Levy</TableHead>
                  <TableHead>Net pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center">
                      <EmptyState className="bg-transparent border-0" icon={<DollarSign className="h-5 w-5" />} title="No payroll entries" description={`No records for ${month}.`} />
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => {
                    const emp = employees.find((e) => e.id === p.employeeId);
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="font-medium">{emp?.name}</div>
                          <div className="text-xs text-muted-foreground">{emp?.employeeCode}</div>
                        </TableCell>
                        <TableCell>S$ {p.basicSalary.toLocaleString()}</TableCell>
                        <TableCell>S$ {p.overtimePay.toLocaleString()}</TableCell>
                        <TableCell>S$ {p.allowances.toLocaleString()}</TableCell>
                        <TableCell>S$ {p.deductions.toLocaleString()}</TableCell>
                        <TableCell>S$ {p.cpfEmployee.toLocaleString()}</TableCell>
                        <TableCell>S$ {p.levies.toLocaleString()}</TableCell>
                        <TableCell className="font-medium">S$ {p.netPay.toLocaleString()}</TableCell>
                        <TableCell>
                          <StatusBadge
                            variant={p.status === "Paid" ? "success" : p.status === "Approved" ? "success" : p.status === "Rejected" ? "destructive" : p.status === "Draft" ? "ghost" : "warning"}
                            label={p.status}
                            dot
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Select value="" onValueChange={(v) => setStatus(p, v as PayrollStatus)}>
                              <SelectTrigger className="h-8 w-32 text-xs">
                                <SelectValue placeholder="Set status" />
                              </SelectTrigger>
                              <SelectContent>
                                {statuses.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="icon" variant="ghost" title="Payslip" onClick={() => setPayslipOf(p)}>
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" title="Delete" onClick={() => handleDelete(p)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <PayslipDialog
          entry={payslipOf}
          employee={payslipOf ? employees.find((e) => e.id === payslipOf.employeeId) : undefined}
          companyName={
            companies.find((c) => c.id === employees.find((e) => e.id === payslipOf?.employeeId)?.companyId)?.name ??
            "BSM Engineering"
          }
          onClose={() => setPayslipOf(null)}
        />
      </div>
    </AppShell>
  );
}

function PayslipDialog({
  entry,
  employee,
  companyName,
  onClose,
}: {
  entry: PayrollEntry | null;
  employee?: Employee;
  companyName: string;
  onClose: () => void;
}) {
  if (!entry) return null;
  const money = (n: number) => `S$ ${n.toLocaleString()}`;
  const rows: [string, number][] = [
    ["Basic salary", entry.basicSalary],
    ["Overtime", entry.overtimePay],
    ["Allowances", entry.allowances],
    ["Deductions", -entry.deductions],
    ["CPF (employee)", -entry.cpfEmployee],
  ];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Payslip — {entry.month}</DialogTitle>
          <DialogDescription>{companyName}</DialogDescription>
        </DialogHeader>
        <div id="payslip-print" className="space-y-4 rounded-lg border p-4 text-sm">
          <div>
            <div className="text-base font-semibold">{employee?.name}</div>
            <div className="text-xs text-muted-foreground">
              {employee?.employeeCode} · {employee?.trade} · {employee?.passType}
            </div>
          </div>
          <div className="space-y-1">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground">{label}</span>
                <span>{money(value)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Net pay</span>
            <span>{money(entry.netPay)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Employer CPF {money(entry.cpfEmployer)}</span>
            <span>Levy {money(entry.levies)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayrollForm({ employees, onSubmit }: { employees: ReturnType<typeof getEmployees>; onSubmit: (data: FormData) => void }) {
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
          <Label htmlFor="month">Month</Label>
          <Input id="month" name="month" type="month" defaultValue="2026-07" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="basicSalary">Basic salary</Label>
          <Input id="basicSalary" name="basicSalary" type="number" defaultValue={0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="overtimePay">Overtime pay</Label>
          <Input id="overtimePay" name="overtimePay" type="number" defaultValue={0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="allowances">Allowances</Label>
          <Input id="allowances" name="allowances" type="number" defaultValue={0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deductions">Deductions</Label>
          <Input id="deductions" name="deductions" type="number" defaultValue={0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cpfEmployee">CPF employee</Label>
          <Input id="cpfEmployee" name="cpfEmployee" type="number" defaultValue={0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cpfEmployer">CPF employer</Label>
          <Input id="cpfEmployer" name="cpfEmployer" type="number" defaultValue={0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="levies">Levies</Label>
          <Input id="levies" name="levies" type="number" defaultValue={0} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select name="status" defaultValue="Draft">
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
      </div>
      <DialogFooter>
        <Button type="submit">Save payroll</Button>
      </DialogFooter>
    </form>
  );
}
