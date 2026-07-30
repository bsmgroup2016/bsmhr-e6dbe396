import { useMemo, useState } from "react";
import { Wallet, HandCoins, AlertTriangle, Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getEmployees, getLoans, getLoanRepayments, getCurrentCompany,
  addLoan, updateLoan, deleteLoan, addLoanRepayment, deleteLoanRepayment,
} from "@/lib/store";
import { exportRows, timestampedName } from "@/lib/xlsx";
import { loanLedger, loanSummary, loanExportRows, LOAN_RECOVERY_CAP, type LoanLedgerRow } from "@/lib/loans";
import type { EmployeeLoan, LoanRepayment } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const money = (n: number) => `S$${n.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const LOAN_TYPES: EmployeeLoan["loanType"][] = ["Salary Advance", "Personal Loan", "Air Ticket", "Agent Fee", "Other"];
const LOAN_STATUS: EmployeeLoan["status"][] = ["Active", "Settled", "Written Off", "Cancelled"];
const SOURCES: LoanRepayment["source"][] = ["Payroll", "Cash", "Bank Transfer", "Adjustment"];

const emptyLoan = {
  employeeId: "", loanType: "Salary Advance" as EmployeeLoan["loanType"], principal: 0,
  issuedOn: today(), firstDeductionMonth: thisMonth(), monthlyInstallment: 0,
  purpose: "", consentSigned: false, status: "Active" as EmployeeLoan["status"], remarks: "",
};

export function LoanLedgerPanel() {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const employees = useMemo(() => getEmployees(), [tick]);
  const rows = useMemo(
    () => loanLedger(getLoans(), getLoanRepayments(), employees),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick],
  );
  const repayments = useMemo(() => getLoanRepayments(), [tick]);
  const summary = loanSummary(rows);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(emptyLoan);
  const [payFor, setPayFor] = useState<LoanLedgerRow | null>(null);
  const [payDraft, setPayDraft] = useState({ amount: 0, paidOn: today(), month: thisMonth(), source: "Payroll" as LoanRepayment["source"], remarks: "" });

  const saveLoan = () => {
    if (!draft.employeeId) return toast.error("Select an employee.");
    if (draft.principal <= 0) return toast.error("Principal must be greater than zero.");
    addLoan({ ...draft, companyId: getCurrentCompany() || undefined });
    setDraft(emptyLoan);
    setOpen(false);
    refresh();
    toast.success("Loan recorded.");
  };

  const savePayment = () => {
    if (!payFor) return;
    if (payDraft.amount <= 0) return toast.error("Enter a repayment amount.");
    addLoanRepayment({ ...payDraft, loanId: payFor.loan.id, employeeId: payFor.loan.employeeId });
    setPayFor(null);
    setPayDraft({ amount: 0, paidOn: today(), month: thisMonth(), source: "Payroll", remarks: "" });
    refresh();
    toast.success("Repayment posted.");
  };

  const exportLedger = async () => {
    await exportRows(loanExportRows(rows), timestampedName("loan-ledger", "xlsx"), "Loan Ledger");
    toast.success("Loan ledger exported.");
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Active loans" value={summary.activeLoans} icon={<HandCoins className="h-5 w-5" />} />
        <SummaryCard title="Total disbursed" value={money(summary.totalPrincipal)} icon={<Wallet className="h-5 w-5" />} />
        <SummaryCard title="Outstanding" value={money(summary.totalOutstanding)} icon={<Wallet className="h-5 w-5" />} variant="warning" />
        <SummaryCard title="Compliance flags" value={summary.flagged} icon={<AlertTriangle className="h-5 w-5" />} variant={summary.flagged ? "destructive" : "default"} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
        <p className="text-sm text-muted-foreground">
          MOM caps loan / advance recovery at {Math.round(LOAN_RECOVERY_CAP * 100)}% of monthly salary and requires
          signed worker consent before any deduction.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportLedger}>
            <Download className="mr-2 h-4 w-4" /> Export ledger
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="mr-2 h-4 w-4" /> New loan / advance</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Record loan or salary advance</DialogTitle>
                <DialogDescription>Set the installment within the 25% salary cap and confirm written consent.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label>Employee</Label>
                  <Select value={draft.employeeId} onValueChange={(v) => setDraft({ ...draft, employeeId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name} — {e.employeeCode}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={draft.loanType} onValueChange={(v) => setDraft({ ...draft, loanType: v as EmployeeLoan["loanType"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LOAN_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={draft.status} onValueChange={(v) => setDraft({ ...draft, status: v as EmployeeLoan["status"] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{LOAN_STATUS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Principal (S$)</Label>
                  <Input type="number" value={draft.principal} onChange={(e) => setDraft({ ...draft, principal: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Monthly installment (S$)</Label>
                  <Input type="number" value={draft.monthlyInstallment} onChange={(e) => setDraft({ ...draft, monthlyInstallment: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>Issued on</Label>
                  <Input type="date" value={draft.issuedOn} onChange={(e) => setDraft({ ...draft, issuedOn: e.target.value })} />
                </div>
                <div>
                  <Label>First deduction month</Label>
                  <Input type="month" value={draft.firstDeductionMonth} onChange={(e) => setDraft({ ...draft, firstDeductionMonth: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label>Purpose</Label>
                  <Textarea rows={2} value={draft.purpose} onChange={(e) => setDraft({ ...draft, purpose: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <Checkbox checked={draft.consentSigned} onCheckedChange={(v) => setDraft({ ...draft, consentSigned: !!v })} />
                  Signed worker consent obtained for salary deduction
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={saveLoan}>Save loan</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<HandCoins className="h-6 w-6" />}
          title="No loans recorded"
          description="Record salary advances, air tickets or personal loans to track recovery against payroll."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Loan</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Repaid</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="w-40">Recovery</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.loan.id}>
                  <TableCell className="font-medium">
                    {r.loan.loanNo}
                    <div className="text-xs text-muted-foreground">{r.loan.loanType}</div>
                  </TableCell>
                  <TableCell>
                    {r.employee?.name ?? "—"}
                    <div className="text-xs text-muted-foreground">{r.employee?.employeeCode ?? ""}</div>
                  </TableCell>
                  <TableCell className="text-right">{money(r.loan.principal)}</TableCell>
                  <TableCell className="text-right">{money(r.repaid)}</TableCell>
                  <TableCell className="text-right font-medium">{money(r.outstanding)}</TableCell>
                  <TableCell>
                    <Progress value={Math.round(r.progress * 100)} className="h-2" />
                    <div className="mt-1 text-xs text-muted-foreground">
                      {money(r.loan.monthlyInstallment)}/mo · {r.monthsRemaining} mo left
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      label={r.loan.status}
                      variant={r.loan.status === "Active" ? "info" : r.loan.status === "Settled" ? "success" : "ghost"}
                      dot
                    />
                    {r.issues.length > 0 && (
                      <div className="mt-1 text-xs text-destructive">{r.issues.join("; ")}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={r.outstanding <= 0}
                        onClick={() => {
                          setPayFor(r);
                          setPayDraft({
                            amount: Math.min(r.loan.monthlyInstallment || r.outstanding, r.outstanding),
                            paidOn: today(), month: thisMonth(), source: "Payroll", remarks: "",
                          });
                        }}
                      >
                        Repay
                      </Button>
                      {r.loan.status === "Active" && (
                        <Button variant="ghost" size="sm" onClick={() => { updateLoan(r.loan.id, { status: "Settled" }); refresh(); }}>
                          Settle
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { deleteLoan(r.loan.id); refresh(); toast.success("Loan deleted."); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {repayments.length > 0 && (
        <div className="rounded-lg border border-border/60">
          <div className="border-b border-border/60 px-4 py-2 text-sm font-medium">Repayment history</div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Loan</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repayments.slice(0, 50).map((p) => {
                  const row = rows.find((r) => r.loan.id === p.loanId);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{p.paidOn ?? "—"}</TableCell>
                      <TableCell className="text-xs">{p.month ?? "—"}</TableCell>
                      <TableCell className="text-xs">{row?.loan.loanNo ?? "—"}</TableCell>
                      <TableCell className="text-xs">{row?.employee?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{p.source}</TableCell>
                      <TableCell className="text-right text-xs">{money(p.amount)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => { deleteLoanRepayment(p.id); refresh(); }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={!!payFor} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Post repayment</DialogTitle>
            <DialogDescription>
              {payFor ? `${payFor.loan.loanNo} — outstanding ${money(payFor.outstanding)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Amount (S$)</Label>
              <Input type="number" value={payDraft.amount} onChange={(e) => setPayDraft({ ...payDraft, amount: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Source</Label>
              <Select value={payDraft.source} onValueChange={(v) => setPayDraft({ ...payDraft, source: v as LoanRepayment["source"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Paid on</Label>
              <Input type="date" value={payDraft.paidOn} onChange={(e) => setPayDraft({ ...payDraft, paidOn: e.target.value })} />
            </div>
            <div>
              <Label>Payroll month</Label>
              <Input type="month" value={payDraft.month} onChange={(e) => setPayDraft({ ...payDraft, month: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label>Remarks</Label>
              <Input value={payDraft.remarks} onChange={(e) => setPayDraft({ ...payDraft, remarks: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayFor(null)}>Cancel</Button>
            <Button onClick={savePayment}>Post repayment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
