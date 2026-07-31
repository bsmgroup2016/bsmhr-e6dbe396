/**
 * Medical claim tracking: hospital bills raised against a worker's FWMI policy
 * or WICA work-injury cover, with insurer/employer settlement and utilisation
 * against the insured limit.
 */
import { useMemo, useState } from "react";
import { AlertTriangle, Download, FileText, HeartPulse, Pencil, Plus, Trash2, Wallet, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/ui/status-badge";
import { SummaryCard } from "@/components/ui/summary-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { FileUpload } from "@/components/file-upload";
import { downloadR2File, downloadR2FilesAsZip, openR2File, r2FileName } from "@/lib/r2";
import { extractMedicalBill } from "@/lib/ocr";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { addMedicalClaim, deleteMedicalClaim, getMedicalClaims, updateMedicalClaim } from "@/lib/store";
import { exportRows } from "@/lib/xlsx";
import type { Employee, MedicalClaim } from "@/lib/types";
import {
  CLAIM_STATUSES, CLAIM_TYPES, claimRows, claimSummary, utilisation,
} from "@/lib/medical-claims";

const sgd = (n: number) => `$${n.toLocaleString("en-SG", { maximumFractionDigits: 2 })}`;

type Form = Partial<MedicalClaim>;

const blank = (employeeId: string): Form => ({
  employeeId,
  claimType: "Inpatient",
  status: "Draft",
  totalAmount: 0,
  insurerPaid: 0,
  employerPaid: 0,
  employeePaid: 0,
  workInjury: false,
  momReported: false,
  treatmentDate: new Date().toISOString().slice(0, 10),
});

interface Props {
  employees: Employee[];
  onChanged?: () => void;
}

export function MedicalClaimsPanel({ employees, onChanged }: Props) {
  const [version, setVersion] = useState(0);
  const claims = useMemo(() => getMedicalClaims(), [version]);
  const [status, setStatus] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(blank(employees[0]?.id ?? ""));

  const rows = useMemo(() => {
    const all = claimRows(claims, employees);
    return status === "all" ? all : all.filter((r) => r.claim.status === status);
  }, [claims, employees, status]);
  const summary = useMemo(() => claimSummary(rows), [rows]);
  const usage = useMemo(() => utilisation(claims, employees), [claims, employees]);

  const set = (patch: Form) => setForm((f) => ({ ...f, ...patch }));

  /**
   * Reads the first uploaded bill and pre-fills the empty fields.
   * Anything already typed is kept — OCR never overwrites manual entry.
   */
  const scanBill = async (ref: string) => {
    const toastId = toast.loading("Reading the bill…");
    const result = await extractMedicalBill(ref);
    if (!result.ok) {
      toast.error(result.reason, { id: toastId });
      return;
    }
    const bill = result.data;
    setForm((f) => ({
      ...f,
      provider: f.provider || bill.clinicName || undefined,
      treatmentDate: f.treatmentDate || bill.visitDate || undefined,
      diagnosis: f.diagnosis || bill.diagnosis || undefined,
      claimNo: f.claimNo || bill.billNumber || undefined,
      totalAmount: Number(f.totalAmount ?? 0) > 0 ? f.totalAmount : (bill.amount ?? 0),
    }));
    toast.success("Bill read — check the amount and date before saving", { id: toastId });
  };

  const downloadBill = (ref: string) => {
    void downloadR2File(ref).catch((e) =>
      toast.error(e instanceof Error ? e.message : "Download failed"),
    );
  };

  const [zipping, setZipping] = useState<string | null>(null);

  const downloadAllBills = async (id: string, claimNo: string, refs: string[]) => {
    if (refs.length === 0) return;
    setZipping(id);
    const toastId = toast.loading(`Preparing ${refs.length} bills…`);
    try {
      const { added, failed } = await downloadR2FilesAsZip(
        refs,
        `bills-${(claimNo || "claim").replace(/[^\w.-]+/g, "-")}.zip`,
      );
      if (added === 0) {
        toast.error("Could not package the bills — downloading them individually", { id: toastId });
        for (const ref of refs) await downloadR2File(ref);
      } else if (failed.length > 0) {
        toast.warning(`${added} bills zipped, ${failed.length} could not be read`, { id: toastId });
      } else {
        toast.success(`${added} bills downloaded as ZIP`, { id: toastId });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed", { id: toastId });
    } finally {
      setZipping(null);
    }
  };

  const openNew = () => {
    setEditingId(null);
    setForm(blank(employees[0]?.id ?? ""));
    setOpen(true);
  };

  const openEdit = (claim: MedicalClaim) => {
    setEditingId(claim.id);
    setForm({ ...claim });
    setOpen(true);
  };

  const save = () => {
    if (!form.employeeId) {
      toast.error("Select an employee");
      return;
    }
    const payload = {
      companyId: form.companyId,
      employeeId: form.employeeId,
      claimNo: form.claimNo,
      claimType: form.claimType ?? "Inpatient",
      treatmentDate: form.treatmentDate,
      provider: form.provider,
      diagnosis: form.diagnosis,
      totalAmount: Number(form.totalAmount ?? 0),
      insurer: form.insurer,
      policyNo: form.policyNo,
      insurerPaid: Number(form.insurerPaid ?? 0),
      employerPaid: Number(form.employerPaid ?? 0),
      employeePaid: Number(form.employeePaid ?? 0),
      workInjury: Boolean(form.workInjury),
      momReported: Boolean(form.momReported),
      status: form.status ?? "Draft",
      submittedOn: form.submittedOn,
      settledOn: form.settledOn,
      documentUrl: form.documentUrl,
      remarks: form.remarks,
    };
    if (editingId) updateMedicalClaim(editingId, payload);
    else addMedicalClaim(payload);
    toast.success(editingId ? "Claim updated" : "Claim recorded");
    setOpen(false);
    setVersion((v) => v + 1);
    onChanged?.();
  };

  const remove = (id: string) => {
    deleteMedicalClaim(id);
    toast.success("Claim deleted");
    setVersion((v) => v + 1);
    onChanged?.();
  };

  const exportAll = () => {
    exportRows(
      rows.map((r) => ({
        "Claim no": r.claim.claimNo,
        "P-File Number": r.employeeCode,
        Employee: r.employeeName,
        Type: r.claim.claimType,
        "Treatment date": r.claim.treatmentDate ?? "",
        Provider: r.claim.provider ?? "",
        Diagnosis: r.claim.diagnosis ?? "",
        "Total bill": r.claim.totalAmount,
        Insurer: r.claim.insurer ?? "",
        "Insurer paid": r.claim.insurerPaid,
        "Employer paid": r.claim.employerPaid,
        "Employee paid": r.claim.employeePaid,
        Outstanding: r.outstanding,
        "Work injury": r.claim.workInjury ? "Yes" : "No",
        "MOM reported": r.claim.momReported ? "Yes" : "No",
        Status: r.claim.status,
        Issues: r.issues.join("; ") || "Compliant",
      })),
      "medical-claims",
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Claims" value={String(summary.claims)} icon={<HeartPulse className="h-5 w-5" />} />
        <SummaryCard title="Total billed" value={sgd(summary.billed)} icon={<Wallet className="h-5 w-5" />} />
        <SummaryCard
          title="Outstanding"
          value={sgd(summary.outstanding)}
          icon={<Wallet className="h-5 w-5" />}
          variant={summary.outstanding > 0 ? "warning" : "success"}
        />
        <SummaryCard
          title="Issues"
          value={String(summary.issues)}
          icon={<AlertTriangle className="h-5 w-5" />}
          variant={summary.issues > 0 ? "destructive" : "success"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {CLAIM_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={exportAll}><Download className="mr-2 h-4 w-4" />Export</Button>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Record claim</Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<HeartPulse className="h-6 w-6" />}
          title="No medical claims"
          description="Record hospital bills and insurer settlements to track FWMI and WICA exposure."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Claim</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Bill</TableHead>
                <TableHead className="text-right">Insurer</TableHead>
                <TableHead className="text-right">Employer</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Bill</TableHead>
                <TableHead>Issues</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.claim.id}>
                  <TableCell className="font-medium">
                    {r.claim.claimNo}
                    <div className="text-xs text-muted-foreground">{r.claim.treatmentDate ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    {r.employeeName}
                    <div className="text-xs text-muted-foreground">{r.employeeCode}</div>
                  </TableCell>
                  <TableCell>
                    {r.claim.claimType}
                    {r.claim.workInjury && <div className="text-xs text-muted-foreground">WICA</div>}
                  </TableCell>
                  <TableCell className="text-right">{sgd(r.claim.totalAmount)}</TableCell>
                  <TableCell className="text-right">{sgd(r.claim.insurerPaid)}</TableCell>
                  <TableCell className="text-right">{sgd(r.claim.employerPaid)}</TableCell>
                  <TableCell className="text-right">{sgd(r.outstanding)}</TableCell>
                  <TableCell>
                    <StatusBadge
                      label={r.claim.status}
                      variant={
                        r.claim.status === "Paid" ? "success"
                          : r.claim.status === "Rejected" ? "destructive"
                          : r.claim.status === "Approved" ? "info" : "warning"
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {(r.claim.documentUrls?.length ?? 0) > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {r.claim.documentUrls!.map((u, i) => (
                          <div key={`${u}-${i}`} className="flex items-center">
                            <Button size="sm" variant="ghost" onClick={() => void openR2File(u)}>
                              <FileText className="mr-1 h-4 w-4" />{i + 1}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Download bill ${i + 1}`}
                              onClick={() => downloadBill(u)}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        {(r.claim.documentUrls?.length ?? 0) > 1 && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={zipping === r.claim.id}
                            onClick={() =>
                              void downloadAllBills(r.claim.id, r.claim.claimNo, r.claim.documentUrls ?? [])
                            }
                          >
                            <Download className="mr-1 h-4 w-4" />
                            ZIP ({r.claim.documentUrls!.length})
                          </Button>
                        )}
                      </div>
                    ) : r.claim.documentUrl ? (
                      <div className="flex items-center">
                        <Button size="sm" variant="ghost" onClick={() => void openR2File(r.claim.documentUrl!)}>
                          <FileText className="mr-1 h-4 w-4" />View
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="Download bill"
                          onClick={() => downloadBill(r.claim.documentUrl!)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-64 text-xs text-muted-foreground">
                    {r.issues.join("; ") || "Compliant"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r.claim)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(r.claim.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {usage.length > 0 && (
        <div className="space-y-3 rounded-lg border p-4">
          <div className="text-sm font-medium">Insurance utilisation</div>
          {usage.map((u) => (
            <div key={u.employee.id} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{u.employee.name} ({u.employee.employeeCode})</span>
                <span className={u.overLimit ? "text-destructive" : u.nearLimit ? "text-warning" : ""}>
                  {sgd(u.claimed)} / {sgd(u.limit)}
                </span>
              </div>
              <Progress value={Math.min(100, u.ratio * 100)} />
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit medical claim" : "Record medical claim"}</DialogTitle>
            <DialogDescription>
              Track the hospital bill, insurer settlement and any employer or worker share.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Employee</Label>
              <Select value={form.employeeId ?? ""} onValueChange={(v) => set({ employeeId: v })}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name} ({e.employeeCode})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Claim type</Label>
              <Select
                value={form.claimType ?? "Inpatient"}
                onValueChange={(v) => set({ claimType: v as MedicalClaim["claimType"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLAIM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Treatment date</Label>
              <Input type="date" value={form.treatmentDate ?? ""} onChange={(e) => set({ treatmentDate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Provider / hospital</Label>
              <Input value={form.provider ?? ""} onChange={(e) => set({ provider: e.target.value })} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Diagnosis</Label>
              <Input value={form.diagnosis ?? ""} onChange={(e) => set({ diagnosis: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Total bill ($)</Label>
              <Input type="number" value={form.totalAmount ?? 0} onChange={(e) => set({ totalAmount: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status ?? "Draft"}
                onValueChange={(v) => set({ status: v as MedicalClaim["status"] })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLAIM_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Insurer</Label>
              <Input value={form.insurer ?? ""} onChange={(e) => set({ insurer: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Policy no.</Label>
              <Input value={form.policyNo ?? ""} onChange={(e) => set({ policyNo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Insurer paid ($)</Label>
              <Input type="number" value={form.insurerPaid ?? 0} onChange={(e) => set({ insurerPaid: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Employer paid ($)</Label>
              <Input type="number" value={form.employerPaid ?? 0} onChange={(e) => set({ employerPaid: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Employee paid ($)</Label>
              <Input type="number" value={form.employeePaid ?? 0} onChange={(e) => set({ employeePaid: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label>Submitted on</Label>
              <Input type="date" value={form.submittedOn ?? ""} onChange={(e) => set({ submittedOn: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Settled on</Label>
              <Input type="date" value={form.settledOn ?? ""} onChange={(e) => set({ settledOn: e.target.value })} />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="work-injury">Work injury (WICA)</Label>
              <Switch
                id="work-injury"
                checked={Boolean(form.workInjury)}
                onCheckedChange={(v) => set({ workInjury: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="mom-reported">Reported to MOM</Label>
              <Switch
                id="mom-reported"
                checked={Boolean(form.momReported)}
                onCheckedChange={(v) => set({ momReported: v })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <FileUpload
                key={`${editingId ?? "new"}-${(form.documentUrls ?? []).length}`}
                name="claimDocument"
                label="Hospital bills (images or PDFs) — upload one by one"
                folder="medical-claims"
                defaultValue=""
                onUploaded={(url) =>
                  setForm((f) => {
                    const next = [...(f.documentUrls ?? []), url];
                    const isFirst = next.length === 1;
                    if (isFirst) void scanBill(url);
                    return { ...f, documentUrls: next, documentUrl: next[0] };
                  })
                }
              />
              {(form.documentUrls ?? []).length > 0 && (
                <div className="space-y-1 rounded-md border p-2">
                  {(form.documentUrls ?? []).length > 1 && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={zipping === "form"}
                        onClick={() =>
                          void downloadAllBills("form", form.claimNo ?? "claim", form.documentUrls ?? [])
                        }
                      >
                        <Download className="mr-1 h-4 w-4" />
                        Download all ({(form.documentUrls ?? []).length}) as ZIP
                      </Button>
                    </div>
                  )}
                  {(form.documentUrls ?? []).map((u, i) => (
                    <div key={`${u}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                      <button
                        type="button"
                        className="flex min-w-0 items-center gap-2 text-left hover:underline"
                        onClick={() => void openR2File(u)}
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate">{r2FileName(u) || `Bill ${i + 1}`}</span>
                      </button>
                      <div className="flex items-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Download ${r2FileName(u)}`}
                        onClick={() => downloadBill(u)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setForm((f) => {
                            const next = (f.documentUrls ?? []).filter((_, idx) => idx !== i);
                            return { ...f, documentUrls: next, documentUrl: next[0] };
                          })
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Remarks</Label>
              <Textarea value={form.remarks ?? ""} onChange={(e) => set({ remarks: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>{editingId ? "Save changes" : "Record claim"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}