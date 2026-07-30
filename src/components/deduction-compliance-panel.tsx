/**
 * Employment Act salary deduction compliance: 50% total cap, 25% accommodation
 * cap, 25% loan recovery cap and written-consent tracking.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, Download, Pencil, Receipt, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { getPayroll, updatePayroll } from "@/lib/store";
import { exportRows } from "@/lib/xlsx";
import type { Employee, PayrollEntry } from "@/lib/types";
import {
  ACCOMMODATION_CAP, LOAN_CAP, TOTAL_DEDUCTION_CAP,
  deductionRows, deductionSummary, type DeductionRow,
} from "@/lib/deductions";

const sgd = (n: number) => `$${n.toLocaleString("en-SG", { maximumFractionDigits: 2 })}`;
const pctText = (n: number) => `${Math.round(n * 100)}%`;

interface Props {
  employees: Employee[];
  onChanged?: () => void;
}

export function DeductionCompliancePanel({ employees, onChanged }: Props) {
  const [version, setVersion] = useState(0);
  const payroll = useMemo(() => getPayroll(), [version]);
  const months = useMemo(
    () => Array.from(new Set(payroll.map((p) => p.month))).sort().reverse(),
    [payroll],
  );
  const [month, setMonth] = useState<string>("all");
  const [editing, setEditing] = useState<DeductionRow | null>(null);
  const [form, setForm] = useState<Partial<PayrollEntry>>({});

  const rows = useMemo(
    () => deductionRows(employees, payroll, month === "all" ? undefined : month),
    [employees, payroll, month],
  );
  const summary = useMemo(() => deductionSummary(rows), [rows]);

  const openEdit = (row: DeductionRow) => {
    setEditing(row);
    setForm({
      accommodationDeduction: row.accommodation,
      loanRepayment: row.loanRepayment,
      otherDeductions: row.other,
      deductionConsent: row.consent,
    });
  };

  const save = () => {
    if (!editing) return;
    const accommodation = Number(form.accommodationDeduction ?? 0);
    const loan = Number(form.loanRepayment ?? 0);
    const other = Number(form.otherDeductions ?? 0);
    updatePayroll(editing.payrollId, {
      accommodationDeduction: accommodation,
      loanRepayment: loan,
      otherDeductions: other,
      deductionConsent: Boolean(form.deductionConsent),
      deductions: accommodation + loan + other,
    });
    toast.success("Deductions updated");
    setEditing(null);
    setVersion((v) => v + 1);
    onChanged?.();
  };

  const exportAll = () => {
    exportRows(
      rows.map((r) => ({
        Month: r.month,
        Code: r.employeeCode,
        Employee: r.employeeName,
        "Gross salary": r.grossSalary,
        Accommodation: r.accommodation,
        "Loan recovery": r.loanRepayment,
        Other: r.other,
        "Total deducted": r.total,
        "Total %": pctText(r.totalPct),
        Consent: r.consent ? "Yes" : "No",
        Issues: r.issues.join("; ") || "Compliant",
      })),
      "deduction-compliance",
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Payroll records" value={String(summary.records)} icon={<Receipt className="h-5 w-5" />} />
        <SummaryCard
          title="Cap breaches"
          value={String(summary.breaches)}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={summary.breaches > 0 ? "destructive" : "success"}
        />
        <SummaryCard
          title="Consent missing"
          value={String(summary.missingConsent)}
          icon={<ShieldCheck className="h-5 w-5" />}
          variant={summary.missingConsent > 0 ? "warning" : "success"}
        />
        <SummaryCard title="Total deducted" value={sgd(summary.totalDeducted)} icon={<Receipt className="h-5 w-5" />} />
      </div>

      <p className="text-sm text-muted-foreground">
        Employment Act limits: total deductions ≤ {pctText(TOTAL_DEDUCTION_CAP)} of salary payable,
        accommodation & amenities ≤ {pctText(ACCOMMODATION_CAP)}, loan or advance recovery ≤{" "}
        {pctText(LOAN_CAP)}. CPF and income tax are excluded from the cap.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Month" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All months</SelectItem>
            {months.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={exportAll} disabled={rows.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Export
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-8 w-8" />}
          title="No payroll records"
          description="Generate payroll to review deduction compliance."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Accommodation</TableHead>
                <TableHead className="text-right">Loan</TableHead>
                <TableHead className="text-right">Other</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.payrollId}>
                  <TableCell>
                    <div className="font-medium">{r.employeeName}</div>
                    <div className="text-xs text-muted-foreground">{r.employeeCode}</div>
                  </TableCell>
                  <TableCell>{r.month}</TableCell>
                  <TableCell className="text-right">{sgd(r.grossSalary)}</TableCell>
                  <TableCell className="text-right">{sgd(r.accommodation)}</TableCell>
                  <TableCell className="text-right">{sgd(r.loanRepayment)}</TableCell>
                  <TableCell className="text-right">{sgd(r.other)}</TableCell>
                  <TableCell className="text-right">
                    {sgd(r.total)}
                    <span className="ml-1 text-xs text-muted-foreground">({pctText(r.totalPct)})</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={r.severity === "ok" ? "Compliant" : r.issues[0]}
                      variant={r.severity === "ok" ? "success" : r.severity === "warning" ? "warning" : "destructive"}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit deductions</DialogTitle>
            <DialogDescription>
              {editing?.employeeName} — {editing?.month}. Salary payable {editing ? sgd(editing.grossSalary) : ""}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Accommodation & amenities ($)</Label>
              <Input
                type="number" min={0}
                value={form.accommodationDeduction ?? 0}
                onChange={(e) => setForm({ ...form, accommodationDeduction: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Loan / advance recovery ($)</Label>
              <Input
                type="number" min={0}
                value={form.loanRepayment ?? 0}
                onChange={(e) => setForm({ ...form, loanRepayment: Number(e.target.value) })}
              />
            </div>
            <div className="grid gap-2">
              <Label>Other authorised deductions ($)</Label>
              <Input
                type="number" min={0}
                value={form.otherDeductions ?? 0}
                onChange={(e) => setForm({ ...form, otherDeductions: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Written consent on file</Label>
                <p className="text-xs text-muted-foreground">
                  Required for accommodation and amenity deductions.
                </p>
              </div>
              <Switch
                checked={Boolean(form.deductionConsent)}
                onCheckedChange={(v) => setForm({ ...form, deductionConsent: v })}
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
