import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, CheckCircle2, FileText, Pencil, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { EmployeeRegistration } from "@/components/employee-registration";
import { EmployeeForm, employeeFromForm } from "@/components/employee-form";
import { ExportButton } from "@/components/data-io";
import { OnboardingImport } from "@/components/onboarding-import";
import { FileUpload } from "@/components/file-upload";
import { employeeFormDocuments } from "@/core/employee-form-documents";
import { employeeCompanyId } from "@/core/employee-company";
import { hasOnboarding, newOnboarding, ONBOARD_STAGES, onboardingEmployeePatch, onboardingSchema, readOnboarding, type Onboarding } from "@/core/onboarding";
import { getEmployees, getCompanies, getBranchPrefixes, getDocumentsByEmployee, getCurrentCompany, saveEmployeeConfirmed, saveEmployeeDocumentsConfirmed, subscribe } from "@/lib/store";
import { employeeSlug } from "@/lib/employee-slug";
import type { Employee } from "@/lib/types";
import type { ImportColumn } from "@/lib/xlsx";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [
    { title: "Onboard & Issuence | BSM Workforce" },
    { name: "description", content: "Manage IPA registration, Onboard bookings, completion and MOM Work Permit issuance." },
    { property: "og:title", content: "Onboard & Issuence | BSM Workforce" },
    { property: "og:description", content: "BSM worker onboarding and Work Permit issuance tracking." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: OnboardingPage,
});

const columns: ImportColumn[] = [
  { key: "name", label: "Worker Name", required: true }, { key: "company", label: "Company", required: true },
  { key: "code", label: "P-File Number" }, { key: "fin", label: "FIN" }, { key: "passport", label: "Passport Number" },
  { key: "nationality", label: "Nationality" }, { key: "trade", label: "Designation" },
  { key: "stage", label: "Stage", example: "IPA registered" }, { key: "bookingDate", label: "Onboard Booking Date", example: "2026-11-20" },
  { key: "centre", label: "Onboard Centre" }, { key: "completedDate", label: "Onboard Completion Date" },
  { key: "appointmentDate", label: "MOM Appointment Date" }, { key: "appointmentReference", label: "MOM Reference" },
  { key: "workPermitNumber", label: "Work Permit Number" }, { key: "workPermitIssueDate", label: "Work Permit Issue Date" },
  { key: "workPermitExpiryDate", label: "Work Permit Expiry Date" }, { key: "notes", label: "Notes" },
];
const norm = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

function OnboardingPage() {
  const [employees, setEmployees] = useState(getEmployees);
  useEffect(() => subscribe(() => setEmployees(getEmployees())), []);
  const companies = getCompanies();
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("all");
  const [stage, setStage] = useState("all");
  const [create, setCreate] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [tracking, setTracking] = useState<Employee | null>(null);
  const createdId = useRef<string | undefined>(undefined);
  const tracked = employees.filter(hasOnboarding);
  const scoped = tracked.filter(e => company === "all" || e.companyId === company);
  const filtered = scoped.filter(e => (stage === "all" || readOnboarding(e)?.stage === stage) && (!search || [e.name, e.employeeCode, e.fin, e.passportNumber].some(v => v?.toLowerCase().includes(search.toLowerCase()))));
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, company, stage]);
  const paged = filtered.slice((page - 1) * 15, page * 15);

  async function register(fd: FormData) {
    const values = employeeFromForm(fd);
    const companyId = employeeCompanyId(values.branch, companies, company !== "all" ? company : getCurrentCompany(), getBranchPrefixes());
    if (!companyId) throw new Error("Select a company before registering");
    const data = { ...values, companyId, department: "Construction", site: null };
    const worker = await saveEmployeeConfirmed({ ...data, ...onboardingEmployeePatch(data, newOnboarding()) }, createdId.current);
    createdId.current = worker.id;
    await saveEmployeeDocumentsConfirmed(worker.id, employeeFormDocuments(fd, getDocumentsByEmployee(worker.id)));
    createdId.current = undefined; setCreate(false); toast.success("IPA worker registered for onboarding");
  }

  async function importWorkers(rows: Record<string, string>[]) {
    let imported = 0; const errors: string[] = [];
    if (rows.length > 500) throw new Error("Upload up to 500 workers per batch");
    for (const [index, row] of rows.entries()) {
      try {
        const get = (label: string) => (row[label.toLowerCase()] ?? "").trim();
        const name = z.string().min(1).max(150).parse(get("Worker Name"));
        const selected = companies.filter(c => [c.name, c.code, c.legalName].some(v => v && norm(v) === norm(get("Company"))));
        if (selected.length !== 1) throw new Error("Company must match exactly one registered company");
        const code = get("P-File Number"), fin = get("FIN"), passport = get("Passport Number");
        const matches = getEmployees().filter(e => (code && norm(e.employeeCode) === norm(code)) || (fin && norm(e.fin) === norm(fin)) || (passport && norm(e.passportNumber ?? "") === norm(passport)) || (!code && !fin && !passport && e.companyId === selected[0].id && norm(e.name) === norm(name)));
        if (matches.length > 1) throw new Error("Identifiers match different workers; review manually");
        const existing = matches[0];
        if (existing && (!hasOnboarding(existing) || existing.companyId !== selected[0].id)) throw new Error("Existing workforce worker or company mismatch; no changes made");
        const previous = existing ? readOnboarding(existing) : newOnboarding();
        if (!previous) throw new Error("Tracking data needs manual review");
        const state = onboardingSchema.parse({ ...previous, ...Object.fromEntries(columns.filter(c => c.key in previous && get(c.label)).map(c => [c.key, get(c.label)])) });
        const branch = getBranchPrefixes().find(b => norm(b.name).includes(norm(selected[0].name)))?.name ?? selected[0].name;
        const values: Partial<Employee> = { ...existing, name, companyId: selected[0].id, branch: existing?.branch ?? branch, department: "Construction", site: null, passType: "Work Permit", basicSalary: existing?.basicSalary ?? 0, passExpiry: existing?.passExpiry ?? "-", joinedOn: existing?.joinedOn ?? "", nationality: get("Nationality") || existing?.nationality || "", trade: get("Designation") || existing?.trade || "General Worker", fin: fin || existing?.fin || "", ...(code ? { employeeCode: code } : {}), ...(passport ? { passportNumber: passport } : {}), ...Object.fromEntries(["workPermitNumber", "workPermitIssueDate", "workPermitExpiryDate"].flatMap(key => { const col = columns.find(c => c.key === key); const value = col ? get(col.label) : ""; return value ? [[key, value]] : []; })) };
        await saveEmployeeConfirmed({ ...values, ...onboardingEmployeePatch(values, state) }, existing?.id); imported++;
      } catch (error) { errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "Import failed"}`); }
    }
    return { imported, errors };
  }

  const exportRows = filtered.map(e => { const data = readOnboarding(e); return { "P-File Number": e.employeeCode, "Worker Name": e.name, Company: companies.find(c => c.id === e.companyId)?.name ?? "", FIN: e.fin, "Passport Number": e.passportNumber ?? "", Stage: data?.stage ?? "Needs review", "Onboard Booking Date": data?.bookingDate ?? "", "Onboard Centre": data?.centre ?? "", "Onboard Completion Date": data?.completedDate ?? "", "MOM Appointment Date": data?.appointmentDate ?? "", "MOM Reference": data?.appointmentReference ?? "", "Work Permit Number": e.workPermitNumber ?? "", "Work Permit Issue Date": e.workPermitIssueDate ?? "", "Work Permit Expiry Date": e.workPermitExpiryDate ?? "", Notes: data?.notes ?? "" }; });

  return <AppShell><div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-bold">Onboard & Issuence</h1><div className="flex flex-wrap gap-2">
      <OnboardingImport columns={columns} onImport={importWorkers} />
      <ExportButton rows={exportRows} baseName="Onboard_Issuence" />
      <Button onClick={() => setCreate(true)}><Upload className="mr-2 size-4" />Upload IPA</Button>
    </div></div>
    <div className="grid grid-cols-2 gap-5 border-y py-5 lg:grid-cols-4">
      {[{ title: "Onboard booked", value: scoped.filter(e => readOnboarding(e)?.stage === "Onboard booked").length, icon: CalendarClock }, { title: "At Onboard", value: scoped.filter(e => readOnboarding(e)?.stage === "At Onboard").length, icon: Users }, { title: "MOM appointments", value: scoped.filter(e => readOnboarding(e)?.stage === "MOM appointment booked").length, icon: FileText }, { title: "Work Permits issued", value: scoped.filter(e => readOnboarding(e)?.stage === "Work Permit issued").length, icon: CheckCircle2 }].map(item => <div key={item.title}><div className="flex items-center gap-2 text-sm text-muted-foreground"><item.icon className="size-4 text-primary" />{item.title}</div><p className="mt-2 text-3xl font-semibold">{item.value}</p></div>)}
    </div>
    <div className="flex flex-wrap gap-3"><Input aria-label="Search onboarding workers" placeholder="Name, P-File, FIN, passport…" className="w-full sm:max-w-xs" value={search} onChange={e => setSearch(e.target.value)} />
      <Select value={company} onValueChange={setCompany}><SelectTrigger className="w-full sm:w-64" aria-label="Company"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All companies</SelectItem>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
      <Select value={stage} onValueChange={setStage}><SelectTrigger className="w-full sm:w-56" aria-label="Stage"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All stages</SelectItem>{ONBOARD_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      {(search || company !== "all" || stage !== "all") && <Button variant="ghost" onClick={() => { setSearch(""); setCompany("all"); setStage("all"); }}>Clear filters</Button>}
    </div>
    <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>Worker / P-File</TableHead><TableHead>Company</TableHead><TableHead>Stage</TableHead><TableHead>Onboard booking</TableHead><TableHead>MOM appointment</TableHead><TableHead>Main document</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
      {paged.map(e => { const data = readOnboarding(e); return <TableRow key={e.id}><TableCell><p className="font-medium">{e.name}</p><p className="text-xs text-muted-foreground">{e.employeeCode} · {e.fin || e.passportNumber || "Identity pending"}</p></TableCell><TableCell>{companies.find(c => c.id === e.companyId)?.name}</TableCell><TableCell><Badge variant={data?.stage === "Work Permit issued" ? "default" : "secondary"}>{data?.stage ?? "Needs review"}</Badge></TableCell><TableCell>{data?.bookingDate || "—"}<p className="text-xs text-muted-foreground">{data?.centre}</p></TableCell><TableCell>{data?.appointmentDate || "—"}<p className="text-xs text-muted-foreground">{data?.appointmentReference}</p></TableCell><TableCell>{data?.stage === "Work Permit issued" ? "Work Permit" : e.ipaDocumentUrl ? "IPA" : "IPA pending"}</TableCell><TableCell><div className="flex justify-end gap-2"><Button variant="outline" size="sm" onClick={() => setTracking(e)}>Update status</Button><Button variant="ghost" size="icon" aria-label={`Edit ${e.name}`} onClick={() => setEditing(e)}><Pencil className="size-4" /></Button></div></TableCell></TableRow>; })}
      {!filtered.length && <TableRow><TableCell colSpan={7} className="h-40 text-center text-muted-foreground">{tracked.length ? "No workers match these filters." : "No onboarding workers registered yet."}</TableCell></TableRow>}
    </TableBody></Table></div>
    <div className="flex items-center justify-between text-sm text-muted-foreground"><span>{filtered.length} workers</span><div className="flex items-center gap-3"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button><span>{page} / {Math.max(1, Math.ceil(filtered.length / 15))}</span><Button variant="outline" size="sm" disabled={page * 15 >= filtered.length} onClick={() => setPage(p => p + 1)}>Next</Button></div></div>
    <Dialog open={create} onOpenChange={setCreate}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl"><DialogHeader><DialogTitle>Upload IPA for onboarding</DialogTitle></DialogHeader><EmployeeRegistration onSubmit={register} existingEmployeeId={createdId.current} /></DialogContent></Dialog>
    <Dialog open={Boolean(editing)} onOpenChange={open => { if (!open) setEditing(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>Edit worker particulars</DialogTitle></DialogHeader>{editing && <EmployeeForm initialValues={editing} existingEmployeeId={editing.id} onSubmit={async fd => { const current = getEmployees().find(e => e.id === editing.id); if (!current) throw new Error("Worker not found"); const state = readOnboarding(current); if (!state) throw new Error("Tracking data needs review"); const values = { ...current, ...employeeFromForm(fd), internalNotes: current.internalNotes }; await saveEmployeeConfirmed({ ...values, ...onboardingEmployeePatch(values, state) }, current.id); await saveEmployeeDocumentsConfirmed(current.id, employeeFormDocuments(fd, getDocumentsByEmployee(current.id))); setEditing(null); toast.success("Worker particulars saved"); }} />}</DialogContent></Dialog>
    {tracking && <TrackingDialog key={tracking.id} employee={tracking} onClose={() => setTracking(null)} />}
  </div></AppShell>;
}

function TrackingDialog({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const [data, setData] = useState<Onboarding>(() => readOnboarding(employee) ?? newOnboarding());
  const [permit, setPermit] = useState({ workPermitNumber: employee.workPermitNumber ?? "", workPermitIssueDate: employee.workPermitIssueDate ?? "", workPermitExpiryDate: employee.workPermitExpiryDate ?? "" });
  const [ipa, setIpa] = useState(employee.ipaDocumentUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    setBusy(true); setError("");
    try { const current = getEmployees().find(e => e.id === employee.id); if (!current) throw new Error("Worker not found"); const values = { ...current, ...permit, ipaDocumentUrl: ipa }; await saveEmployeeConfirmed({ ...values, ...onboardingEmployeePatch(values, data) }, employee.id); toast.success("Onboarding status saved"); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "Save failed"); } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{employee.name} · {employee.employeeCode}</DialogTitle></DialogHeader>
    <div className="space-y-4"><div className="space-y-2"><Label>Stage</Label><Select value={data.stage} onValueChange={v => setData(d => ({ ...d, stage: z.enum(ONBOARD_STAGES).parse(v) }))}><SelectTrigger aria-label="Onboarding stage"><SelectValue /></SelectTrigger><SelectContent>{ONBOARD_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
    <div className="grid gap-4 sm:grid-cols-2">{([ ["bookingDate", "Onboard booking date", "date"], ["centre", "Onboard centre", "text"], ["completedDate", "Onboard completed on", "date"], ["appointmentDate", "MOM appointment date", "date"], ["appointmentReference", "MOM appointment reference", "text"] ] as const).map(([key, label, type]) => <div key={key} className="space-y-2"><Label htmlFor={`onboard-${key}`}>{label}</Label><Input id={`onboard-${key}`} type={type} value={data[key]} maxLength={200} onChange={e => setData(d => ({ ...d, [key]: e.target.value }))} /></div>)}</div>
    {data.stage === "Work Permit issued" && <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">{([ ["workPermitNumber", "Work Permit number", "text"], ["workPermitIssueDate", "Work Permit issue date", "date"], ["workPermitExpiryDate", "Confirmed expiry date", "date"] ] as const).map(([key, label, type]) => <div key={key} className="space-y-2"><Label htmlFor={key}>{label}</Label><Input id={key} type={type} value={permit[key]} onChange={e => setPermit(p => ({ ...p, [key]: e.target.value }))} /></div>)}</div>}
    <FileUpload name="onboardingIpa" label="IPA document" folder="ipa" accept=".pdf,.jpg,.jpeg,.png,.webp" defaultValue={ipa} onUploaded={setIpa} display="document" documentLabel="IPA" />
    <div className="space-y-2"><Label htmlFor="onboard-notes">Notes</Label><Textarea id="onboard-notes" maxLength={2000} value={data.notes} onChange={e => setData(d => ({ ...d, notes: e.target.value }))} /></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" asChild><Link to="/workforce/$slug" params={{ slug: employeeSlug(employee) }}>Open worker profile</Link></Button><Button disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save status"}</Button></div></div>
  </DialogContent></Dialog>;
}