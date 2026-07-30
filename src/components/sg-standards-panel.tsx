/**
 * Remaining Singapore standards in one place: FWMI medical insurance,
 * IR21 tax clearance, MYE / skills upgrading and Progressive Wage Model.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Eye, HeartPulse, Pencil, Receipt, TrendingUp, Wallet } from "lucide-react";
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
import type { Employee, Ir21Status, PwmSector, SkillCertType, SkillLevel } from "@/lib/types";
import { FWMI_MIN_COVERAGE, fwmiRows, fwmiSummary } from "@/lib/fwmi";
import { IR21_STATUSES, ir21Rows, ir21Summary } from "@/lib/ir21";
import { SKILL_CERT_TYPES, SKILL_LEVELS, myeRows, myeSummary } from "@/lib/mye";
import { PWM_LADDER, PWM_SECTORS, pwmRows, pwmSummary } from "@/lib/pwm";

type Section = "fwmi" | "ir21" | "mye" | "pwm";

interface Props {
  employees: Employee[];
  section: Section;
  onChange?: () => void;
}

export function SgStandardsPanel({ employees, section, onChange }: Props) {
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<Partial<Employee>>({});

  const fwmi = useMemo(() => fwmiRows(employees), [employees]);
  const ir21 = useMemo(() => ir21Rows(employees), [employees]);
  const mye = useMemo(() => myeRows(employees), [employees]);
  const pwm = useMemo(() => pwmRows(employees), [employees]);

  function openEdit(e: Employee) {
    setEditing(e);
    setForm({
      insuranceCoverage: e.insuranceCoverage,
      insuranceInsurer: e.insuranceInsurer,
      insurancePolicyNo: e.insurancePolicyNo,
      medicalInsuranceExpiry: e.medicalInsuranceExpiry,
      ir21Status: e.ir21Status,
      ir21FiledOn: e.ir21FiledOn,
      ir21AmountWithheld: e.ir21AmountWithheld,
      skillLevel: e.skillLevel,
      skillCertType: e.skillCertType,
      skillCertNo: e.skillCertNo,
      skillCertExpiry: e.skillCertExpiry,
      myeRef: e.myeRef,
      myeManYears: e.myeManYears,
      pwmSector: e.pwmSector,
      pwmLevel: e.pwmLevel,
    });
  }

  function save() {
    if (!editing) return;
    updateEmployee(editing.id, form);
    toast.success(`Updated ${editing.name}`);
    setEditing(null);
    onChange?.();
  }

  const actions = (e: Employee) => (
    <div className="flex justify-end gap-1">
      <Button size="icon" variant="ghost" title="Update" onClick={() => openEdit(e)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button size="icon" variant="ghost" asChild title="Open profile">
        <Link to="/workforce/$slug" params={{ slug: employeeSlugById(e.id) }}><Eye className="h-4 w-4" /></Link>
      </Button>
    </div>
  );

  const empty = (title: string, description: string) => (
    <TableRow>
      <TableCell colSpan={6} className="h-32 text-center">
        <EmptyState className="border-0 bg-transparent" icon={<HeartPulse className="h-5 w-5" />} title={title} description={description} />
      </TableCell>
    </TableRow>
  );

  const fwmiS = fwmiSummary(fwmi);
  const irS = ir21Summary(ir21);
  const myeS = myeSummary(mye);
  const pwmS = pwmSummary(pwm);

  return (
    <div className="space-y-4">
      {section === "fwmi" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard title="Insurable workers" value={String(fwmiS.total)} icon={<HeartPulse className="h-5 w-5" />} variant="info" caption="Work Permit & S Pass" />
            <SummaryCard title="Coverage gaps" value={String(fwmiS.gaps)} icon={<HeartPulse className="h-5 w-5" />} variant={fwmiS.gaps ? "destructive" : "success"} caption={`Minimum $${FWMI_MIN_COVERAGE.toLocaleString()}`} />
            <SummaryCard title="Expiring in 30 days" value={String(fwmiS.expiring)} icon={<HeartPulse className="h-5 w-5" />} variant={fwmiS.expiring ? "warning" : "success"} caption="Renew policies" />
            <SummaryCard title="Total sum insured" value={`$${fwmiS.insuredValue.toLocaleString()}`} icon={<HeartPulse className="h-5 w-5" />} variant="default" caption="Across active policies" />
          </div>
          <Card
            title="Foreign Worker Medical Insurance"
            subtitle="MOM requires inpatient and day-surgery cover for every Work Permit and S Pass holder."
            onExport={() => void exportRows(fwmi.map((r) => ({
              Name: r.employee.name, FIN: r.employee.fin, Status: r.state,
              Insurer: r.employee.insuranceInsurer ?? "", Policy: r.employee.insurancePolicyNo ?? "",
              Coverage: r.coverage, Required: r.required, Expiry: r.employee.medicalInsuranceExpiry ?? "", Note: r.note,
            })), "fwmi", "Insurance")}
            disabled={!fwmi.length}
            head={["Employee", "Status", "Coverage", "Insurer", "Expiry", ""]}
          >
            {fwmi.length === 0 ? empty("No foreign pass holders", "Add Work Permit or S Pass workers to track insurance.") : fwmi.map((r) => (
              <TableRow key={r.employee.id}>
                <TableCell>
                  <div className="font-medium">{r.employee.name}</div>
                  <div className="text-xs text-muted-foreground">{r.employee.employeeCode}</div>
                </TableCell>
                <TableCell>
                  <StatusBadge dot
                    variant={r.state === "Compliant" ? "success" : r.state === "Expiring" ? "warning" : "destructive"}
                    label={r.state} />
                  <div className="text-xs text-muted-foreground">{r.note}</div>
                </TableCell>
                <TableCell>${r.coverage.toLocaleString()}</TableCell>
                <TableCell className="text-sm">{r.employee.insuranceInsurer ?? "—"}</TableCell>
                <TableCell className="text-sm">{r.employee.medicalInsuranceExpiry ?? "—"}</TableCell>
                <TableCell>{actions(r.employee)}</TableCell>
              </TableRow>
            ))}
          </Card>
        </>
      )}

      {section === "ir21" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard title="Clearances in progress" value={String(irS.total)} icon={<Receipt className="h-5 w-5" />} variant="info" caption="Departing foreign staff" />
            <SummaryCard title="Overdue filings" value={String(irS.overdue)} icon={<Receipt className="h-5 w-5" />} variant={irS.overdue ? "destructive" : "success"} caption="File IR21 immediately" />
            <SummaryCard title="Due soon" value={String(irS.due)} icon={<Receipt className="h-5 w-5" />} variant={irS.due ? "warning" : "success"} caption="One month before last day" />
            <SummaryCard title="Monies withheld" value={`$${irS.withheld.toLocaleString()}`} icon={<Wallet className="h-5 w-5" />} variant="default" caption="Hold until IRAS clears" />
          </div>
          <Card
            title="IR21 tax clearance"
            subtitle="File Form IR21 at least one month before a foreign employee stops working, and withhold final monies until IRAS responds."
            onExport={() => void exportRows(ir21.map((r) => ({
              Name: r.employee.name, FIN: r.employee.fin, "Last working day": r.employee.lastWorkingDate ?? "",
              "File by": r.dueDate ?? "", Status: r.status, "Filed on": r.employee.ir21FiledOn ?? "",
              Withheld: r.employee.ir21AmountWithheld ?? 0, Note: r.note,
            })), "ir21", "Tax clearance")}
            disabled={!ir21.length}
            head={["Employee", "Last working day", "File by", "Status", "Withheld", ""]}
          >
            {ir21.length === 0 ? empty("Nothing to clear", "No departing foreign employees right now.") : ir21.map((r) => (
              <TableRow key={r.employee.id}>
                <TableCell>
                  <div className="font-medium">{r.employee.name}</div>
                  <div className="text-xs text-muted-foreground">{r.note}</div>
                </TableCell>
                <TableCell className="text-sm">{r.employee.lastWorkingDate ?? "—"}</TableCell>
                <TableCell className={r.severity === "overdue" ? "text-sm font-medium text-destructive" : "text-sm"}>{r.dueDate ?? "—"}</TableCell>
                <TableCell>
                  <StatusBadge dot
                    variant={r.status === "Cleared" ? "success" : r.status === "Filed" ? "info" : r.severity === "overdue" ? "destructive" : "warning"}
                    label={r.status} />
                </TableCell>
                <TableCell>{r.employee.ir21AmountWithheld ? `$${r.employee.ir21AmountWithheld.toLocaleString()}` : "—"}</TableCell>
                <TableCell>{actions(r.employee)}</TableCell>
              </TableRow>
            ))}
          </Card>
        </>
      )}

      {section === "mye" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard title="Work Permit holders" value={String(myeS.workers)} icon={<TrendingUp className="h-5 w-5" />} variant="info" caption="Construction / process" />
            <SummaryCard title="Higher Skilled" value={String(myeS.higherSkilled)} icon={<TrendingUp className="h-5 w-5" />} variant="success" caption={`${myeS.basicSkilled} still Basic Skilled`} />
            <SummaryCard title="Certificate gaps" value={String(myeS.certGaps)} icon={<TrendingUp className="h-5 w-5" />} variant={myeS.certGaps ? "destructive" : "success"} caption="Higher Skilled without valid cert" />
            <SummaryCard title="Man-years used" value={myeS.manYearsUsed.toFixed(1)} icon={<TrendingUp className="h-5 w-5" />} variant="default" caption={`Upgrade saving up to $${myeS.potentialSaving.toLocaleString()}/mo`} />
          </div>
          <Card
            title="MYE & skills upgrading"
            subtitle="Track Man-Year Entitlement usage and the TCTO / SETO certificates that keep workers on the Higher Skilled levy tier."
            onExport={() => void exportRows(mye.map((r) => ({
              Name: r.employee.name, FIN: r.employee.fin, "Skill level": r.skillLevel,
              Certificate: r.employee.skillCertType ?? "", "Cert no": r.employee.skillCertNo ?? "",
              "Cert expiry": r.employee.skillCertExpiry ?? "", "MYE ref": r.employee.myeRef ?? "",
              "Man-years": r.manYears, Issues: r.issues.map((i) => i.label).join("; "),
            })), "mye-skills", "MYE")}
            disabled={!mye.length}
            head={["Employee", "Skill level", "Certificate", "MYE ref", "Notes", ""]}
          >
            {mye.length === 0 ? empty("No Work Permit holders", "MYE tracking applies to construction and process Work Permits.") : mye.map((r) => (
              <TableRow key={r.employee.id}>
                <TableCell>
                  <div className="font-medium">{r.employee.name}</div>
                  <div className="text-xs text-muted-foreground">{r.employee.trade || "—"}</div>
                </TableCell>
                <TableCell>
                  <StatusBadge dot variant={r.skillLevel === "Higher Skilled" ? "success" : "default"} label={r.skillLevel} />
                </TableCell>
                <TableCell className="text-sm">
                  {r.employee.skillCertType ?? "—"}
                  {r.employee.skillCertExpiry && <div className="text-xs text-muted-foreground">exp {r.employee.skillCertExpiry}</div>}
                </TableCell>
                <TableCell className="text-sm">{r.employee.myeRef ?? "—"}</TableCell>
                <TableCell className="max-w-[18rem] text-xs text-muted-foreground">
                  {r.issues.map((i) => i.label).join(" · ") || "—"}
                </TableCell>
                <TableCell>{actions(r.employee)}</TableCell>
              </TableRow>
            ))}
          </Card>
        </>
      )}

      {section === "pwm" && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard title="PWM covered staff" value={String(pwmS.covered)} icon={<Wallet className="h-5 w-5" />} variant="info" caption="Sectors with a wage ladder" />
            <SummaryCard title="Below wage floor" value={String(pwmS.belowFloor)} icon={<Wallet className="h-5 w-5" />} variant={pwmS.belowFloor ? "destructive" : "success"} caption="Raise to the PWM minimum" />
            <SummaryCard title="Monthly shortfall" value={`$${pwmS.totalShortfall.toLocaleString()}`} icon={<Wallet className="h-5 w-5" />} variant={pwmS.totalShortfall ? "warning" : "success"} caption="Total top-up needed" />
          </div>
          <Card
            title="Progressive Wage Model"
            subtitle="Cleaning, security, landscape, lift, waste, retail, food services, administrator and driver roles have statutory wage floors."
            onExport={() => void exportRows(pwm.map((r) => ({
              Name: r.employee.name, Sector: r.sector, Level: r.level,
              "PWM floor": r.floor, "Actual basic + allowance": r.actual, Shortfall: r.shortfall,
            })), "pwm", "PWM")}
            disabled={!pwm.length}
            head={["Employee", "Sector", "Level", "PWM floor", "Actual", ""]}
          >
            {pwm.length === 0 ? empty("No PWM roles tagged", "Set a PWM sector on local employees to check their wage floor.") : pwm.map((r) => (
              <TableRow key={r.employee.id}>
                <TableCell>
                  <div className="font-medium">{r.employee.name}</div>
                  <div className="text-xs text-muted-foreground">{r.employee.employeeCode}</div>
                </TableCell>
                <TableCell className="text-sm">{r.sector}</TableCell>
                <TableCell className="text-sm">{r.level}</TableCell>
                <TableCell>${r.floor.toLocaleString()}</TableCell>
                <TableCell className={r.compliant ? "" : "font-medium text-destructive"}>
                  ${r.actual.toLocaleString()}
                  {!r.compliant && <div className="text-xs">short by ${r.shortfall.toLocaleString()}</div>}
                </TableCell>
                <TableCell>{actions(r.employee)}</TableCell>
              </TableRow>
            ))}
          </Card>
        </>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Singapore compliance — {editing?.name}</DialogTitle>
            <DialogDescription>Medical insurance, tax clearance, skills upgrading and Progressive Wage details.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Insurance coverage ($)</Label>
              <Input type="number" value={form.insuranceCoverage ?? ""} placeholder={String(FWMI_MIN_COVERAGE)}
                onChange={(ev) => setForm((f) => ({ ...f, insuranceCoverage: ev.target.value ? Number(ev.target.value) : undefined }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Insurer</Label>
              <Input value={form.insuranceInsurer ?? ""} onChange={(ev) => setForm((f) => ({ ...f, insuranceInsurer: ev.target.value || undefined }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Policy number</Label>
              <Input value={form.insurancePolicyNo ?? ""} onChange={(ev) => setForm((f) => ({ ...f, insurancePolicyNo: ev.target.value || undefined }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Policy expiry</Label>
              <Input type="date" value={form.medicalInsuranceExpiry ?? ""} onChange={(ev) => setForm((f) => ({ ...f, medicalInsuranceExpiry: ev.target.value || undefined }))} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">IR21 status</Label>
              <Select value={form.ir21Status ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, ir21Status: v as Ir21Status }))}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>{IR21_STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">IR21 filed on</Label>
              <Input type="date" value={form.ir21FiledOn ?? ""} onChange={(ev) => setForm((f) => ({ ...f, ir21FiledOn: ev.target.value || undefined }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Monies withheld ($)</Label>
              <Input type="number" value={form.ir21AmountWithheld ?? ""}
                onChange={(ev) => setForm((f) => ({ ...f, ir21AmountWithheld: ev.target.value ? Number(ev.target.value) : undefined }))} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Skill level</Label>
              <Select value={form.skillLevel ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, skillLevel: v as SkillLevel }))}>
                <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>{SKILL_LEVELS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Skills certificate</Label>
              <Select value={form.skillCertType ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, skillCertType: v as SkillCertType }))}>
                <SelectTrigger><SelectValue placeholder="Select certificate" /></SelectTrigger>
                <SelectContent>{SKILL_CERT_TYPES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Certificate number</Label>
              <Input value={form.skillCertNo ?? ""} onChange={(ev) => setForm((f) => ({ ...f, skillCertNo: ev.target.value || undefined }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Certificate expiry</Label>
              <Input type="date" value={form.skillCertExpiry ?? ""} onChange={(ev) => setForm((f) => ({ ...f, skillCertExpiry: ev.target.value || undefined }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">MYE reference</Label>
              <Input value={form.myeRef ?? ""} onChange={(ev) => setForm((f) => ({ ...f, myeRef: ev.target.value || undefined }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Man-years used</Label>
              <Input type="number" step="0.1" value={form.myeManYears ?? ""}
                onChange={(ev) => setForm((f) => ({ ...f, myeManYears: ev.target.value ? Number(ev.target.value) : undefined }))} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">PWM sector</Label>
              <Select value={form.pwmSector ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, pwmSector: v as PwmSector, pwmLevel: undefined }))}>
                <SelectTrigger><SelectValue placeholder="Not applicable" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="None">None</SelectItem>
                  {PWM_SECTORS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">PWM level</Label>
              <Select
                value={form.pwmLevel ?? ""}
                onValueChange={(v) => setForm((f) => ({ ...f, pwmLevel: v }))}
                disabled={!form.pwmSector || form.pwmSector === "None"}
              >
                <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>
                  {(form.pwmSector && form.pwmSector !== "None" ? PWM_LADDER[form.pwmSector] : []).map((s) => (
                    <SelectItem key={s.level} value={s.level}>{s.level} — ${s.minWage.toLocaleString()}</SelectItem>
                  ))}
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

function Card({
  title, subtitle, head, children, onExport, disabled,
}: {
  title: string;
  subtitle: string;
  head: string[];
  children: React.ReactNode;
  onExport: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">{title}</h2>
          <p className="max-w-3xl text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onExport} disabled={disabled}>
          <Download className="mr-1 h-4 w-4" /> Export
        </Button>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {head.map((h, i) => (<TableHead key={h || i} className={i === head.length - 1 ? "w-24" : undefined}>{h}</TableHead>))}
            </TableRow>
          </TableHeader>
          <TableBody>{children}</TableBody>
        </Table>
      </div>
    </div>
  );
}