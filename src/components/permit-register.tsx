import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Download, Eye, FileText, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OnboardingImport } from "@/components/onboarding-import";
import { PERMIT_COLUMNS, PERMIT_FIELDS, permitSchema, permitStatus, preparePermitImport, type PermitUpdate } from "@/core/permit-register";
import { savePermitDetails } from "@/lib/permit-register.functions";
import { employeeSlug } from "@/lib/employee-slug";
import { exportRows } from "@/lib/xlsx";
import { openR2File } from "@/lib/r2";
import { ensureStoreCollections } from "@/lib/store";
import { sessionDataCache } from "@/lib/session-data-cache";
import type { Employee, Company, EmployeeDocument } from "@/lib/types";

export function PermitRegister({ employees, companies, documents }: { employees: Employee[]; companies: Company[]; documents: EmployeeDocument[] }) {
  const save = useServerFn(savePermitDetails);
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [values, setValues] = useState<PermitUpdate>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Singapore", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const workers = employees.filter(e => e.passType === "Work Permit");
  const filtered = workers.filter(e => (company === "all" || e.companyId === company) && (status === "all" || permitStatus(e, today) === status) && (!search || [e.name, e.employeeCode, e.fin, e.workPermitNumber, e.passportNumber].some(v => v?.toLowerCase().includes(search.trim().toLowerCase()))));
  async function refresh() { sessionDataCache.invalidate("employees|"); await ensureStoreCollections(["employees"]); }
  function validate(row: Record<string, string>) { try { preparePermitImport(row, employees); return []; } catch (e) { return [e instanceof Error ? e.message : "Invalid row"]; } }
  async function importRows(rows: Record<string, string>[]) {
    if (rows.length > 500) throw new Error("Upload up to 500 workers per batch");
    let imported = 0; const errors: string[] = []; const ids = new Set<string>();
    for (const [index, row] of rows.entries()) {
      try {
        const prepared = preparePermitImport(row, employees);
        if (ids.has(prepared.employee.id)) throw new Error("Repeated worker in this batch; combine changes into one row");
        ids.add(prepared.employee.id);
        await save({ data: { id: prepared.employee.id, patch: prepared.patch } }); imported++;
      } catch (e) { errors.push(`Record ${index + 1}: ${e instanceof Error ? e.message : "Save failed"}`); }
    }
    if (imported) { try { await refresh(); } catch { errors.push("Updates saved, but list refresh failed. Reload the page."); } }
    return { imported, errors };
  }
  async function saveEdit() {
    if (!editing) return;
    setBusy(true); setError("");
    try { const patch = permitSchema.parse(values); await save({ data: { id: editing.id, patch } }); await refresh(); setEditing(null); toast.success("Permit details saved"); }
    catch (e) { setError(e instanceof Error ? e.message : "Save failed"); } finally { setBusy(false); }
  }
  const companyName = (e: Employee) => companies.find(c => c.id === e.companyId)?.name ?? "Unassigned";
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Work Permit register <span className="text-muted-foreground">({workers.length})</span></h2><div className="flex flex-wrap gap-2">
      <OnboardingImport columns={PERMIT_COLUMNS} title="Bulk update permit & compliance records" templateName="permit_compliance_template.xlsx" fileLabel="Permit spreadsheet" previewLabels={["P-File Number", "FIN", "Work Permit Number", "Work Permit Expiry Date"]} validateRow={validate} onImport={importRows} />
      <Button size="sm" variant="outline" disabled={!filtered.length} onClick={() => void exportRows(filtered.map(e => ({ "P-File Number": e.employeeCode, "Worker Name": e.name, Company: companyName(e), FIN: e.fin, ...Object.fromEntries(PERMIT_FIELDS.map(([key, label]) => [label, e[key] ?? ""])), Status: permitStatus(e, today) })), "work-permit-register", "Permits")}><Download className="mr-2 size-4" />Export</Button>
    </div></div>
    <div className="flex flex-wrap gap-3"><Input aria-label="Search work permits" placeholder="Name, P-File, FIN or permit number…" className="w-full sm:max-w-xs" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      <Select value={company} onValueChange={v => { setCompany(v); setPage(1); }}><SelectTrigger className="w-full sm:w-64" aria-label="Permit company"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All companies</SelectItem>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
      <Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}><SelectTrigger className="w-full sm:w-52" aria-label="Permit status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All permit status</SelectItem>{["Valid", "Due within 30 days", "Due within 90 days", "Expired", "Missing expiry"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
      {(search || company !== "all" || status !== "all") && <Button variant="ghost" onClick={() => { setSearch(""); setCompany("all"); setStatus("all"); setPage(1); }}>Clear filters</Button>}
    </div>
    <div className="overflow-x-auto rounded-lg border"><Table><TableHeader><TableRow>{["Worker / P-File", "Company", "FIN / Permit", "Issue date", "Confirmed expiry", "Status", "Actions"].map(h => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader><TableBody>
      {filtered.slice((page - 1) * 15, page * 15).map(e => { const state = permitStatus(e, today); const doc = documents.find(d => d.employeeId === e.id && d.type === "Work Permit"); return <TableRow key={e.id}><TableCell><p className="font-medium">{e.name}</p><p className="text-xs text-muted-foreground">{e.employeeCode} · {e.status}</p></TableCell><TableCell>{companyName(e)}</TableCell><TableCell>{e.fin || "—"}<p className="text-xs text-muted-foreground">{e.workPermitNumber || "Permit number pending"}</p></TableCell><TableCell>{e.workPermitIssueDate || "—"}</TableCell><TableCell>{e.workPermitExpiryDate || (e.passExpiry !== "-" ? e.passExpiry : "") || "—"}</TableCell><TableCell><Badge variant={state === "Expired" ? "destructive" : state === "Valid" ? "default" : "secondary"}>{state}</Badge></TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="icon" title="Edit permit details" aria-label={`Edit permit for ${e.name}`} onClick={() => { setEditing(e); setValues(Object.fromEntries(PERMIT_FIELDS.map(([key]) => [key, e[key] ?? ""]))); setError(""); }}><Pencil className="size-4" /></Button>{doc?.fileUrl && <Button variant="ghost" size="icon" title="Open Work Permit document" onClick={() => { const url = doc.fileUrl; if (url) void openR2File(url).catch(() => toast.error("Could not open permit document")); }}><FileText className="size-4" /></Button>}<Button variant="ghost" size="icon" title="Open worker profile" asChild><Link to="/workforce/$slug" params={{ slug: employeeSlug(e) }}><Eye className="size-4" /></Link></Button></div></TableCell></TableRow>; })}
      {!filtered.length && <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">{workers.length ? "No permits match these filters." : "No Work Permit workers recorded."}</TableCell></TableRow>}
    </TableBody></Table></div>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><span>{filtered.length} workers</span><div className="flex items-center gap-3"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button><span>{page} / {Math.max(1, Math.ceil(filtered.length / 15))}</span><Button variant="outline" size="sm" disabled={page * 15 >= filtered.length} onClick={() => setPage(p => p + 1)}>Next</Button></div></div>
    <Dialog open={Boolean(editing)} onOpenChange={open => { if (!open && !busy) setEditing(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Permit & compliance details · {editing?.name}</DialogTitle></DialogHeader><div className="grid gap-4 sm:grid-cols-2">{PERMIT_FIELDS.map(([key, label, type]) => <div key={key} className="space-y-2"><Label htmlFor={`permit-${key}`}>{label}</Label><Input id={`permit-${key}`} type={type} maxLength={type === "date" ? 10 : 100} value={values[key] ?? ""} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} /></div>)}</div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setEditing(null)}>Cancel</Button><Button disabled={busy} onClick={() => void saveEdit()}>{busy ? "Saving…" : "Save details"}</Button></div></DialogContent></Dialog>
  </div>;
}