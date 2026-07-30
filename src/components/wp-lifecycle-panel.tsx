/**
 * Work Permit lifecycle panel: IPA → arrival → medical → card → cancellation →
 * repatriation, with MOM deadline tracking and security bond status.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Eye, IdCard, Pencil, ShieldCheck, Timer } from "lucide-react";
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
import { updateEmployee } from "@/lib/store";
import { exportRows } from "@/lib/xlsx";
import { employeeSlugById } from "@/lib/employee-slug";
import type { Employee, SecurityBondStatus, WpStage } from "@/lib/types";
import {
  SECURITY_BOND_AMOUNT, WP_STAGES, lifecycleRows, lifecycleSummary,
} from "@/lib/wp-lifecycle";

const BOND_STATUSES: SecurityBondStatus[] = ["Not Required", "Active", "Discharged", "Forfeited"];

const stageVariant = (stage: WpStage): "success" | "warning" | "default" | "info" =>
  stage === "Active" ? "success"
    : stage === "Cancellation Pending" ? "warning"
      : stage === "Cancelled" || stage === "Repatriated" ? "default"
        : "info";

interface Props {
  employees: Employee[];
  onChange?: () => void;
}

export function WpLifecyclePanel({ employees, onChange }: Props) {
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<Partial<Employee>>({});

  const rows = useMemo(() => lifecycleRows(employees), [employees]);
  const summary = useMemo(() => lifecycleSummary(rows), [rows]);

  function openEdit(e: Employee) {
    setEditing(e);
    setForm({
      wpStage: e.wpStage,
      ipaIssueDate: e.ipaIssueDate,
      ipaExpiryDate: e.ipaExpiryDate,
      arrivalDate: e.arrivalDate,
      medicalCompletedDate: e.medicalCompletedDate,
      wpCardCollectedDate: e.wpCardCollectedDate,
      lastWorkingDate: e.lastWorkingDate,
      cancellationNotifiedOn: e.cancellationNotifiedOn,
      cancellationDate: e.cancellationDate,
      repatriationDate: e.repatriationDate,
      securityBondAmount: e.securityBondAmount,
      securityBondInsurer: e.securityBondInsurer,
      securityBondExpiry: e.securityBondExpiry,
      securityBondStatus: e.securityBondStatus,
    });
  }

  function save() {
    if (!editing) return;
    updateEmployee(editing.id, form);
    toast.success(`Lifecycle updated for ${editing.name}`);
    setEditing(null);
    onChange?.();
  }

  function exportLifecycle() {
    void exportRows(
      rows.map((r) => ({
        "Employee code": r.employee.employeeCode,
        Name: r.employee.name,
        FIN: r.employee.fin,
        Nationality: r.employee.nationality,
        "Pass type": r.employee.passType,
        Stage: r.stage,
        "IPA expiry": r.employee.ipaExpiryDate ?? "",
        "Arrival": r.employee.arrivalDate ?? "",
        "Card collected": r.employee.wpCardCollectedDate ?? "",
        "Last working day": r.employee.lastWorkingDate ?? "",
        "MOM notified": r.employee.cancellationNotifiedOn ?? "",
        Cancelled: r.employee.cancellationDate ?? "",
        Repatriated: r.employee.repatriationDate ?? "",
        "Security bond": r.bondRequired ? (r.bondOk ? "In place" : "Action needed") : "Not required",
        "Open actions": r.tasks.map((t) => `${t.label} (${t.dueDate})`).join("; "),
      })),
      "wp-lifecycle", "Lifecycle",
    );
  }

  const dateField = (key: keyof Employee, label: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="date"
        value={(form[key] as string) ?? ""}
        onChange={(ev) => setForm((f) => ({ ...f, [key]: ev.target.value || undefined }))}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Tracked workers" value={String(summary.total)} icon={<IdCard className="h-5 w-5" />} variant="info" caption="Work Permit & S Pass" />
        <SummaryCard title="Overdue actions" value={String(summary.overdue)} icon={<Timer className="h-5 w-5" />} variant={summary.overdue ? "destructive" : "success"} caption="Past a MOM deadline" />
        <SummaryCard title="Due within 7 days" value={String(summary.dueSoon)} icon={<Timer className="h-5 w-5" />} variant={summary.dueSoon ? "warning" : "success"} caption="Act this week" />
        <SummaryCard title="Security bond gaps" value={String(summary.bondGap)} icon={<ShieldCheck className="h-5 w-5" />} variant={summary.bondGap ? "warning" : "success"} caption={`S$${summary.bondValue.toLocaleString()} bonded`} />
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">Work Permit lifecycle</h2>
            <p className="text-xs text-muted-foreground">
              MOM rules: notify within 1 day of employment ending, cancel the pass within 7 days,
              repatriate within 7 days of cancellation. Non-Malaysian Work Permit holders need a S${SECURITY_BOND_AMOUNT.toLocaleString()} bond.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={exportLifecycle} disabled={!rows.length}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {summary.byStage.filter((s) => s.count > 0).map((s) => (
            <StatusBadge key={s.stage} variant={stageVariant(s.stage)} label={`${s.stage}: ${s.count}`} />
          ))}
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Next action</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Bond</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <EmptyState className="border-0 bg-transparent" icon={<IdCard className="h-5 w-5" />} title="No foreign pass holders" description="Add Work Permit or S Pass workers to track their lifecycle." />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => {
                  const next = r.tasks[0];
                  return (
                    <TableRow key={r.employee.id}>
                      <TableCell>
                        <div className="font-medium">{r.employee.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.employee.employeeCode} · {r.employee.nationality || "—"}
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge variant={stageVariant(r.stage)} label={r.stage} dot /></TableCell>
                      <TableCell className="max-w-[18rem] text-sm">{next ? next.label : "Nothing outstanding"}</TableCell>
                      <TableCell className={next?.severity === "overdue" ? "font-medium text-destructive" : ""}>
                        {next
                          ? next.daysLeft < 0
                            ? `${Math.abs(next.daysLeft)} days overdue`
                            : next.daysLeft === 0 ? "Today" : `in ${next.daysLeft} days`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {!r.bondRequired ? (
                          <span className="text-xs text-muted-foreground">Not required</span>
                        ) : (
                          <StatusBadge variant={r.bondOk ? "success" : "warning"} label={r.bondOk ? "In place" : "Action needed"} dot />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" title="Update lifecycle" onClick={() => openEdit(r.employee)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" asChild title="Open profile">
                            <Link to="/workforce/$slug" params={{ slug: employeeSlugById(r.employee.id) }}><Eye className="h-4 w-4" /></Link>
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

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Work Permit lifecycle — {editing?.name}</DialogTitle>
            <DialogDescription>Record IPA, arrival, card, cancellation and security bond details.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Stage</Label>
              <Select
                value={form.wpStage ?? ""}
                onValueChange={(v) => setForm((f) => ({ ...f, wpStage: v as WpStage }))}
              >
                <SelectTrigger><SelectValue placeholder="Auto (derived from dates)" /></SelectTrigger>
                <SelectContent>
                  {WP_STAGES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            {dateField("ipaIssueDate", "IPA issued on")}
            {dateField("ipaExpiryDate", "IPA expiry")}
            {dateField("arrivalDate", "Arrival in Singapore")}
            {dateField("medicalCompletedDate", "Medical cleared on")}
            {dateField("wpCardCollectedDate", "Card collected on")}
            {dateField("lastWorkingDate", "Last working day")}
            {dateField("cancellationNotifiedOn", "MOM notified on")}
            {dateField("cancellationDate", "Pass cancelled on")}
            {dateField("repatriationDate", "Repatriated on")}
            {dateField("securityBondExpiry", "Security bond expiry")}
            <div className="space-y-1">
              <Label className="text-xs">Security bond amount (S$)</Label>
              <Input
                type="number"
                value={form.securityBondAmount ?? ""}
                placeholder={String(SECURITY_BOND_AMOUNT)}
                onChange={(ev) => setForm((f) => ({ ...f, securityBondAmount: ev.target.value ? Number(ev.target.value) : undefined }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bond insurer / banker</Label>
              <Input
                value={form.securityBondInsurer ?? ""}
                onChange={(ev) => setForm((f) => ({ ...f, securityBondInsurer: ev.target.value || undefined }))}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bond status</Label>
              <Select
                value={form.securityBondStatus ?? ""}
                onValueChange={(v) => setForm((f) => ({ ...f, securityBondStatus: v as SecurityBondStatus }))}
              >
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>
                  {BOND_STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
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