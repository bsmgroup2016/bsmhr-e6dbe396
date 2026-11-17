import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Download, FileSpreadsheet, Pencil, ScanLine, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClaimTemplateManager } from "@/components/claim-template-manager";
import { ClaimWorkbookEditor, type ClaimEditorDocument } from "@/components/claim-workbook-editor";
import { ClaimWorkbookPreview } from "@/components/claim-workbook-preview";
import { createClaimWorkbook, exportCombinedClaims } from "@/lib/combined-claim-export";
import { groupTimeCardRows, splitTimeCardFile } from "@/core/time-card-batch";
import { countedCardHours } from "@/core/time-card-settlement";
import { matchCardWorker, uniqueCardMatch } from "@/core/time-card-matching";
import { uploadToR2 } from "@/lib/r2";
import { extractTimeCardData } from "@/lib/ocr";
import { timestampedName } from "@/lib/xlsx";
import { buildClaimSheetFromCard, getClaimSheets, getClients, getCompanies, getCurrentCompany, getEmployees, getProjects, getSites, saveGeneratedClaims } from "@/lib/store";
import type { TimeCard, TimeCardEntry } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/time-cards")({
  head: () => ({
    meta: [
      { title: "ClaimSheet Generator — BSM Workforce" },
      { name: "description", content: "Upload time cards, check the OCR result and generate project claim sheets." },
      { property: "og:title", content: "ClaimSheet Generator — BSM Workforce" },
      { property: "og:description", content: "Time card upload and claim sheet generation for site workers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TimeCardsPage,
});

/** One worker card read from one uploaded page. Kept in the page until the claim is generated. */
type ReadCard = { id: string; fileName: string; preview: string; isPdf: boolean; workerName: string; employeeCode: string; siteName: string; entries: TimeCardEntry[]; approved: boolean };

const monthEnd = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(y ?? 1970, m ?? 1, 0)).getUTCDate()).padStart(2, "0")}`;
};
/** Changing In/Out recounts GW/OT with the 9h duty = 8h + 1h lunch rule. */
const retime = (e: TimeCardEntry, patch: Partial<TimeCardEntry>) => { const next = { ...e, ...patch, normalHours: undefined, otHours: undefined }; return { ...patch, ...countedCardHours(next) }; };
/** Cards that only show one total per day (e.g. "11 hrs"): first 8 are GW, the rest is OT. */
export const splitWrittenHours = (gw: number, ot: number) => (ot === 0 && gw > 8 ? { normalHours: 8, otHours: gw - 8 } : { normalHours: gw, otHours: ot });
const sum = (entries: TimeCardEntry[], key: "normalHours" | "otHours") => entries.reduce((n, e) => n + (e[key] ?? 0), 0);

function TimeCardsPage() {
  const employees = getEmployees();
  const companyId = getCurrentCompany();
  const projects = getProjects();
  const clients = getClients();
  const lookups = () => ({ projects: getProjects(), sites: getSites(), clients: getClients() });

  const [cards, setCards] = useState<ReadCard[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  const [finalOpen, setFinalOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [sheets, setSheets] = useState(getClaimSheets());
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [previewDoc, setPreviewDoc] = useState<ClaimEditorDocument | null>(null);
  const [editDoc, setEditDoc] = useState<ClaimEditorDocument | null>(null);
  const [tab, setTab] = useState("sheets");
  const input = useRef<HTMLInputElement>(null);
  const busy = progress !== null || generating;

  useEffect(() => () => cards.forEach(card => URL.revokeObjectURL(card.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const cardMonth = cards[0]?.entries[0]?.date.slice(0, 7) ?? month;
  const allApproved = cards.length > 0 && cards.every(card => card.approved);
  const visibleSheets = useMemo(() => sheets.filter(s => s.periodStart.startsWith(month) && (!companyId || !s.companyId || s.companyId === companyId)), [sheets, month, companyId]);

  async function upload(list: FileList | File[] | null) {
    const files = list ? Array.from(list) : [];
    if (!files.length || busy) return;
    const pages: File[] = [];
    const errors: string[] = [];
    for (const file of files) {
      try { pages.push(...await splitTimeCardFile(file)); } catch (e) { errors.push(`${file.name}: ${e instanceof Error ? e.message : "could not open"}`); }
    }
    setProgress({ done: 0, total: pages.length });
    const read: ReadCard[] = [];
    for (const [i, page] of pages.entries()) {
      try {
        const uploaded = await uploadToR2(page, "time-cards");
        const ocr = await extractTimeCardData(uploaded.url);
        if (!ocr.ok) throw new Error(ocr.reason);
        const groups = groupTimeCardRows(ocr.data);
        if (!groups.length) throw new Error("no dates could be read");
        const preview = URL.createObjectURL(page);
        for (const group of groups) {
          const entries = group.entries.map(r => {
            const entry: TimeCardEntry = { date: r.date, workerName: group.identity.workerName, employeeCode: group.identity.employeeCode, fin: group.identity.fin, siteName: group.identity.siteName, checkIn: r.checkIn, checkOut: r.checkOut, normalHours: r.normalHours, otHours: r.otHours, remarks: r.remarks, confidence: r.confidence };
            const counted = countedCardHours(entry);
            return { ...entry, ...splitWrittenHours(counted.normalHours, counted.otHours) };
          }).sort((a, b) => a.date.localeCompare(b.date));
          read.push({ id: crypto.randomUUID(), fileName: page.name, preview, isPdf: page.type === "application/pdf", workerName: group.identity.workerName ?? "", employeeCode: group.identity.employeeCode ?? "", siteName: group.identity.siteName ?? "", entries, approved: false });
        }
      } catch (e) { errors.push(`${page.name}: ${e instanceof Error ? e.message : "could not be read"}`); }
      setProgress({ done: i + 1, total: pages.length });
    }
    setProgress(null);
    setFailed(errors);
    if (errors.length) toast.error(`${errors.length} file(s) could not be read`);
    if (read.length) {
      const start = cards.length;
      setCards(items => [...items, ...read]);
      setReviewIndex(start);
      toast.success(`Read ${read.length} time card(s)`);
    }
  }

  const patchCard = (id: string, patch: Partial<ReadCard>) => setCards(items => items.map(card => card.id === id ? { ...card, ...patch } : card));
  const patchEntry = (card: ReadCard, date: string, patch: Partial<TimeCardEntry>) => patchCard(card.id, { entries: card.entries.map(e => e.date === date ? { ...e, ...patch } : e) });

  function approveAndNext() {
    if (reviewIndex === null) return;
    const card = cards[reviewIndex];
    if (!card) return;
    const updated = cards.map((c, i) => i === reviewIndex ? { ...c, approved: true } : c);
    setCards(updated);
    const next = updated.findIndex(c => !c.approved);
    if (next >= 0) setReviewIndex(next);
    else { setReviewIndex(null); setFinalOpen(true); }
  }

  function toTimeCard(card: ReadCard): TimeCard {
    const m = card.entries[0]?.date.slice(0, 7) ?? cardMonth;
    const project = projects.find(p => p.id === projectId);
    const siteId = uniqueCardMatch(getSites(), card.siteName, s => [s.name, s.code]) || undefined;
    return {
      id: card.id, employeeId: matchCardWorker(employees, { workerName: card.workerName, employeeCode: card.employeeCode }), periodStart: `${m}-01`, periodEnd: monthEnd(m), fileName: card.fileName, status: "Draft",
      entries: card.entries.map(e => ({ ...e, workerName: card.workerName, employeeCode: card.employeeCode, siteName: card.siteName, siteId, projectId: project?.id, projectName: project?.name, resolution: "Accepted", reviewApproved: true })),
    };
  }

  async function generate() {
    if (!allApproved || generating) return;
    setGenerating(true);
    try {
      const drafts = cards.map(toTimeCard).map(card => {
        const snapshot = buildClaimSheetFromCard(card);
        const employee = employees.find(e => e.id === card.employeeId);
        return { id: card.id, reference: card.id, employeeId: card.employeeId || undefined, companyId: employee?.companyId ?? (companyId || undefined), periodStart: card.periodStart, periodEnd: card.periodEnd, totalDays: snapshot.length, totalNormalHours: snapshot.reduce((n, r) => n + r.normalHours, 0), totalOtHours: snapshot.reduce((n, r) => n + r.otHours, 0), snapshot };
      }).filter(d => d.snapshot.length);
      if (!drafts.length) throw new Error("No worked hours to claim");
      const workbook = await createClaimWorkbook(drafts, employees, getCompanies(), cardMonth, lookups());
      await saveGeneratedClaims(drafts.map(({ id, reference, ...claim }) => ({ ...claim, sourceCardId: id })));
      setSheets(getClaimSheets()); setMonth(cardMonth); setTab("sheets");
      setFinalOpen(false); setCards([]); setFailed([]); setProjectId("");
      setPreviewDoc({ workbook, fileName: timestampedName(`claim_sheet_${cardMonth}`, "xlsx") });
      toast.success(`Claim sheet ready — ${drafts.length} worker(s)`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Claim generation failed"); }
    finally { setGenerating(false); }
  }

  async function openExcel(mode: "edit" | "preview") {
    try {
      const workbook = await createClaimWorkbook(visibleSheets, employees, getCompanies(), month, lookups());
      const doc = { workbook, fileName: timestampedName(`claim_sheet_${month}`, "xlsx") };
      if (mode === "edit") setEditDoc(doc); else setPreviewDoc(doc);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not open Excel"); }
  }

  const step = allApproved ? 3 : cards.length ? 2 : 1;
  const review = reviewIndex !== null ? cards[reviewIndex] : undefined;

  return (
    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">ClaimSheet Generator</h1>
          <ClaimTemplateManager />
        </div>

        <section className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Generate Claim Sheet</h2>
          </div>
          <ol className="grid gap-2 sm:grid-cols-3">
            {["Upload time cards", "Check & approve", "Generate claim sheet"].map((label, i) => {
              const n = i + 1; const active = n === step; const done = n < step;
              return (
                <li key={label} className={`flex min-w-0 items-center gap-3 rounded-lg border p-3 ${active ? "border-primary bg-primary/10" : "border-border"}`}>
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${done ? "bg-success text-success-foreground" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{done ? <CheckCircle2 className="h-4 w-4" /> : n}</span>
                  <span className={`truncate text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                </li>
              );
            })}
          </ol>

          <label htmlFor="claim-upload" onDragOver={e => { e.preventDefault(); if (!busy) setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); void upload(e.dataTransfer?.files ?? null); }}
            className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${busy ? "pointer-events-none opacity-60" : "cursor-pointer"} ${dragOver ? "border-primary bg-primary/20" : "border-primary/40 bg-primary/5 hover:bg-primary/10"}`}>
            <span className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground"><Upload className="h-6 w-6" /></span>
            <Button type="button" variant="outline" disabled={busy} onClick={e => { e.preventDefault(); input.current?.click(); }}><Upload aria-hidden="true" />Choose time cards</Button>
            <span className="text-base font-semibold text-foreground">{progress ? `Reading cards ${progress.done}/${progress.total}…` : dragOver ? "Drop the cards here" : "Click or drag time cards here"}</span>
            <span className="text-sm text-muted-foreground">PDF or photos · select many at once · one project per batch</span>
          </label>
          <input ref={input} id="claim-upload" aria-label="Upload time cards" className="hidden" type="file" multiple accept="image/*,application/pdf" onChange={e => { void upload(e.target.files); e.target.value = ""; }} />

          {failed.length > 0 && <div role="alert" className="border-l-4 border-destructive bg-destructive/10 p-3 text-sm"><p className="font-semibold">These files could not be read — upload them again:</p><ul className="list-disc pl-5">{failed.map(f => <li key={f}>{f}</li>)}</ul></div>}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <span className="text-sm text-muted-foreground">{cards.filter(c => c.approved).length}/{cards.length} cards approved</span>
            <div className="flex flex-wrap gap-2">
              {cards.length > 0 && <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm("Clear this batch?")) { setCards([]); setFailed([]); } }}>Clear batch</Button>}
              {cards.length > 0 && !allApproved && <Button variant="outline" onClick={() => setReviewIndex(cards.findIndex(c => !c.approved))}>Continue checking</Button>}
              <Button disabled={!allApproved || busy} onClick={() => setFinalOpen(true)} className="gap-2"><FileSpreadsheet className="h-4 w-4" />Generate claim sheet</Button>
            </div>
          </div>
        </section>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="sheets">Claim sheets</TabsTrigger>
            <TabsTrigger value="cards">Time cards</TabsTrigger>
          </TabsList>
          <TabsContent value="sheets" className="mt-4">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Input aria-label="Claim sheets month" type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-44" />
              <span className="text-sm text-muted-foreground">{visibleSheets.length} worker claim(s)</span>
              <Button variant="outline" className="gap-2" disabled={!visibleSheets.length} onClick={() => void openExcel("edit")}><Pencil className="h-4 w-4" />Edit Excel</Button>
              <Button variant="outline" className="gap-2" disabled={!visibleSheets.length} onClick={() => void exportCombinedClaims(visibleSheets, employees, "", getCompanies(), month, lookups()).catch(e => toast.error(e instanceof Error ? e.message : "Download failed"))}><Download className="h-4 w-4" />Download claim sheet (Excel)</Button>
            </div>
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader><TableRow><TableHead>Reference</TableHead><TableHead>Worker</TableHead><TableHead>Period</TableHead><TableHead>Days</TableHead><TableHead>GW hrs</TableHead><TableHead>OT hrs</TableHead></TableRow></TableHeader>
                <TableBody>
                  {visibleSheets.length === 0 ? <TableRow><TableCell colSpan={6} className="h-32 text-center"><EmptyState className="border-0 bg-transparent" icon={<FileSpreadsheet className="h-5 w-5" />} title="No claim sheets" description="Upload time cards to make one." /></TableCell></TableRow>
                    : visibleSheets.map(s => <TableRow key={s.id}><TableCell className="font-medium">{s.reference}</TableCell><TableCell>{s.snapshot.find(r => r.workerName)?.workerName || employees.find(e => e.id === s.employeeId)?.name || "—"}</TableCell><TableCell className="text-sm text-muted-foreground">{s.periodStart} → {s.periodEnd}</TableCell><TableCell>{s.totalDays}</TableCell><TableCell>{s.totalNormalHours}</TableCell><TableCell>{s.totalOtHours}</TableCell></TableRow>)}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
          <TabsContent value="cards" className="mt-4">
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader><TableRow><TableHead>Worker</TableHead><TableHead>Site</TableHead><TableHead>Days</TableHead><TableHead>GW / OT</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {cards.length === 0 ? <TableRow><TableCell colSpan={6} className="h-32 text-center"><EmptyState className="border-0 bg-transparent" icon={<ScanLine className="h-5 w-5" />} title="No time cards" description="Upload cards above." /></TableCell></TableRow>
                    : cards.map((c, i) => <TableRow key={c.id}><TableCell className="font-medium">{c.employeeCode} {c.workerName}</TableCell><TableCell>{c.siteName || "—"}</TableCell><TableCell>{c.entries.length}</TableCell><TableCell>{sum(c.entries, "normalHours")} / {sum(c.entries, "otHours")}</TableCell><TableCell>{c.approved ? "Approved" : "To check"}</TableCell><TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setReviewIndex(i)}>Open</Button></TableCell></TableRow>)}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={!!review} onOpenChange={open => { if (!open) setReviewIndex(null); }}>
          <DialogContent className="max-h-[95dvh] max-w-6xl overflow-y-auto">
            {review && <>
              <DialogHeader><DialogTitle>Check time card {reviewIndex! + 1} of {cards.length}</DialogTitle></DialogHeader>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="min-w-0 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1"><Label htmlFor="rv-code">Staff code</Label><Input id="rv-code" value={review.employeeCode} onChange={e => patchCard(review.id, { employeeCode: e.target.value })} /></div>
                    <div className="space-y-1"><Label htmlFor="rv-name">Name</Label><Input id="rv-name" value={review.workerName} onChange={e => patchCard(review.id, { workerName: e.target.value })} /></div>
                    <div className="space-y-1"><Label htmlFor="rv-site">Site</Label><Input id="rv-site" value={review.siteName} onChange={e => patchCard(review.id, { siteName: e.target.value })} /></div>
                  </div>
                  <div className="max-h-[55dvh] overflow-y-auto rounded-lg border">
                    <Table>
                      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>In</TableHead><TableHead>Out</TableHead><TableHead>GW</TableHead><TableHead>OT</TableHead></TableRow></TableHeader>
                      <TableBody>{review.entries.map(e => (
                        <TableRow key={e.date} className={e.confidence !== undefined && e.confidence < 0.7 ? "bg-warning/15" : undefined}>
                          <TableCell className="whitespace-nowrap text-sm">{e.date}</TableCell>
                          <TableCell><Input aria-label={`In ${e.date}`} className="h-8 w-20" value={e.checkIn ?? ""} onChange={ev => patchEntry(review, e.date, retime(e, { checkIn: ev.target.value }))} /></TableCell>
                          <TableCell><Input aria-label={`Out ${e.date}`} className="h-8 w-20" value={e.checkOut ?? ""} onChange={ev => patchEntry(review, e.date, retime(e, { checkOut: ev.target.value }))} /></TableCell>
                          <TableCell><Input aria-label={`GW ${e.date}`} className="h-8 w-16" type="number" min={0} step="0.5" value={e.normalHours ?? 0} onChange={ev => patchEntry(review, e.date, { normalHours: Math.max(0, Number(ev.target.value) || 0) })} /></TableCell>
                          <TableCell><Input aria-label={`OT ${e.date}`} className="h-8 w-16" type="number" min={0} step="0.5" value={e.otHours ?? 0} onChange={ev => patchEntry(review, e.date, { otHours: Math.max(0, Number(ev.target.value) || 0) })} /></TableCell>
                        </TableRow>))}
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-sm text-muted-foreground">{review.entries.length} days · GW {sum(review.entries, "normalHours")} h · OT {sum(review.entries, "otHours")} h{review.entries.some(e => e.confidence !== undefined && e.confidence < 0.7) ? " · highlighted rows were hard to read" : ""}</p>
                </div>
                <div className="min-w-0">
                  {review.isPdf ? <iframe title="Time card" src={review.preview} className="h-[65dvh] w-full rounded-lg border bg-muted" />
                    : <div className="h-[65dvh] overflow-auto rounded-lg border bg-muted"><img src={review.preview} alt="Original time card" className="w-full" /></div>}
                </div>
              </div>
              <div className="flex justify-end"><Button onClick={approveAndNext} className="gap-2"><CheckCircle2 className="h-4 w-4" />Approve & go</Button></div>
            </>}
          </DialogContent>
        </Dialog>

        <Dialog open={finalOpen} onOpenChange={setFinalOpen}>
          <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
            <DialogHeader><DialogTitle>Final review — {cardMonth}</DialogTitle></DialogHeader>
            <div className="space-y-1">
              <Label>Project / Client (optional)</Label>
              <Select value={projectId || "none"} onValueChange={v => setProjectId(v === "none" ? "" : v)}>
                <SelectTrigger aria-label="Project / Client"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">No project selected</SelectItem>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}{clients.find(c => c.id === p.clientId) ? ` / ${clients.find(c => c.id === p.clientId)?.name}` : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Staff code</TableHead><TableHead>Name</TableHead><TableHead>Site</TableHead><TableHead>Days</TableHead><TableHead>GW hrs</TableHead><TableHead>OT hrs</TableHead></TableRow></TableHeader>
              <TableBody>{[...cards].sort((a, b) => a.employeeCode.localeCompare(b.employeeCode, undefined, { numeric: true })).map(c => <TableRow key={c.id}><TableCell>{c.employeeCode || "—"}</TableCell><TableCell>{c.workerName || "—"}</TableCell><TableCell>{c.siteName}</TableCell><TableCell>{c.entries.length}</TableCell><TableCell>{sum(c.entries, "normalHours")}</TableCell><TableCell>{sum(c.entries, "otHours")}</TableCell></TableRow>)}</TableBody>
            </Table>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setFinalOpen(false); setReviewIndex(0); }}>Back to cards</Button>
              <Button disabled={generating} onClick={() => void generate()} className="gap-2"><FileSpreadsheet className="h-4 w-4" />{generating ? "Generating…" : "Generate claim sheet"}</Button>
            </div>
          </DialogContent>
        </Dialog>

        <ClaimWorkbookPreview document={previewDoc} onClose={() => setPreviewDoc(null)} />
        <ClaimWorkbookEditor document={editDoc} onClose={() => setEditDoc(null)} />
      </div>
    </AppShell>
  );
}
