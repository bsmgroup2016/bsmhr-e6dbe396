import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Download, Eye, Pencil, FileSpreadsheet, ScanLine, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ImportValidationDialog } from "@/components/verification/import-validation-dialog";


import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { canConfirmCardDetails, cardProjectName, matchCardWorker, uniqueCardMatch, type TimeCardIdentity } from "@/core/time-card-matching";
import { completeTimeCardReview } from "@/core/time-card-review";
import { canGenerateSettledCards, isCardApproved, validCardHours } from "@/core/time-card-settlement";
import { groupTimeCardRows, splitTimeCardFile } from "@/core/time-card-batch";
import { redateToMonth } from "@/core/time-card-read";
import { nextBatchCardId, readBatchState, writeBatchState } from "@/core/time-card-batch-state";
import { projectBatchIssue } from "@/core/time-card-project-batch";
import { createClaimWorkbook, exportCombinedClaims, claimSheetTitle, reconcileClaimWorkbook, type ClaimReconcileIssue } from "@/lib/combined-claim-export";
import { ClaimWorkbookEditor, type ClaimEditorDocument } from "@/components/claim-workbook-editor";
import { ClaimTemplateManager } from "@/components/claim-template-manager";
import { TimeCardHoursInputs } from "@/components/time-card-hours-inputs";
import { ClaimDatePreview } from "@/components/claim-date-preview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExportButton } from "@/components/data-io";
import { timestampedName } from "@/lib/xlsx";
import { uploadToR2 } from "@/lib/r2";
import { extractTimeCardData, OCR_NOT_CONFIGURED, isOcrConfigured } from "@/lib/ocr";
import {
  addClaimSheet,
  addTimeCard,
  buildClaimSheetFromCard,
  compareTimeCard,
  deleteClaimSheet,
  deleteTimeCard,
  getClaimSheets,
  getCurrentCompany,
  getCompanies,
  getEmployees,
  getProjects,
  getClients,
  getSites,
  getTimeCards,
  updateTimeCard,
  updateClaimSheet,
} from "@/lib/store";
import type { TimeCard, TimeCardEntry } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/time-cards")({
  head: () => ({
    meta: [
      { title: "Project Claim Sheets — BSM Workforce" },
      {
        name: "description",
        content:
          "Upload physical time cards, verify them against system attendance and generate claim sheets.",
      },
      { property: "og:title", content: "Project Claim Sheets — BSM Workforce" },
      {
        property: "og:description",
        content: "Time card verification and claim sheet generation for site workers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TimeCardsPage,
});

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  // UTC avoids the local timezone dropping the last day of the month.
  const last = new Date(Date.UTC(y ?? 1970, m ?? 1, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

function TimeCardsPage() {
  const employees = getEmployees();
  const companyId = getCurrentCompany();
  const scoped = employees.filter((e) => !companyId || e.companyId === companyId);
  const clients = getClients();
  const projects = getProjects().filter((project) => clients.some((client) => client.id === project.clientId));
  const [projectId, setProjectId] = useState("");

  const [cards, setCards] = useState(getTimeCards());
  const [sheets, setSheets] = useState(getClaimSheets());
  const [excelDocument, setExcelDocument] = useState<ClaimEditorDocument | null>(null);
  const [editingExcel, setEditingExcel] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const sites = getSites();
  const [siteId, setSiteId] = useState("");
  const [siteName, setSiteName] = useState("");
  type PendingScan = { fileName: string; fileUrl: string; entries: TimeCardEntry[]; identity: TimeCardIdentity };
  const [batchCardIds, setBatchCardIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [claimPreviewOpen, setClaimPreviewOpen] = useState(false);
  const [focusIssue, setFocusIssue] = useState<ClaimReconcileIssue | null>(null);
  const [reconcile, setReconcile] = useState<{ issues: ClaimReconcileIssue[]; workers: number } | null>(null);
  const [pendingScans, setPendingScans] = useState<PendingScan[]>([]);
  const [reviewScan, setReviewScan] = useState<PendingScan | null>(null);
  const [activeTab, setActiveTab] = useState("cards");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [rescanId, setRescanId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verificationSearch, setVerificationSearch] = useState("");
  const [verificationFilter, setVerificationFilter] = useState<
    "All" | "Mismatch" | "Unresolved" | "LowConfidence"
    >("All");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);


  const LOW_CONFIDENCE = 0.7;

  // Keep the active batch (session-local cards + queue) across page reloads/remounts.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const saved = readBatchState(window.sessionStorage);
    if (!saved) return;
    setCards(items => [...items.filter(card => card.employeeId), ...(saved.localCards as TimeCard[])]);
    setBatchCardIds(saved.batchCardIds);
    setPendingScans(saved.pendingScans as PendingScan[]);
    if (saved.month) setMonth(saved.month);
    setProjectId(saved.projectId);
  }, []);
  useEffect(() => {
    if (!restored.current) return;
    writeBatchState(window.sessionStorage, { localCards: cards.filter(card => !card.employeeId && batchCardIds.includes(card.id)), batchCardIds, pendingScans, month, projectId });
  }, [cards, batchCardIds, pendingScans, month, projectId]);

  const selected = cards.find((c) => c.id === selectedId) ?? null;
  const comparison = useMemo(() => (selected ? compareTimeCard(selected) : []), [selected]);
  const settlementCards = cards.filter(card => batchCardIds.length ? batchCardIds.includes(card.id) : scoped.some(employee => employee.id === card.employeeId) && card.periodStart.startsWith(month));
  const approvedCount = settlementCards.filter(isCardApproved).length;
  const batchIssue = projectBatchIssue([
    ...settlementCards.flatMap(card => card.entries),
    ...pendingScans.map(scan => scan.identity),
    ...(reviewScan ? [reviewScan.identity] : []),
  ], { projects, sites }, true);
  const readyToGenerate = !batchIssue && canGenerateSettledCards(settlementCards, pendingScans.length + (reviewScan ? 1 : 0));
  const preparedClaims = settlementCards.map(card => ({ card, snapshot: buildClaimSheetFromCard(card) }));
  const mismatches = comparison.filter((r) => r.state !== "Verified").length;
  const lowConfidenceCount = comparison.filter(
    (r) => r.confidence !== undefined && r.confidence < LOW_CONFIDENCE,
  ).length;

  const filteredComparison = useMemo(() => {
    return comparison.filter((r) => {
      const matchesSearch =
        r.date.includes(verificationSearch) ||
        (r.remarks?.toLowerCase().includes(verificationSearch.toLowerCase()) ?? false);

      const matchesFilter =
        verificationFilter === "All" ||
        (verificationFilter === "Mismatch" && r.state !== "Verified") ||
        (verificationFilter === "Unresolved" && r.state !== "Verified" && !r.resolution) ||
        (verificationFilter === "LowConfidence" &&
          r.confidence !== undefined &&
          r.confidence < LOW_CONFIDENCE);

      return matchesSearch && matchesFilter;
    });
  }, [comparison, verificationSearch, verificationFilter]);

  const empName = (id?: string) => employees.find((e) => e.id === id)?.name ?? "—";
  const cardName = (card: TimeCard) => card.entries[0]?.workerName || empName(card.employeeId);

  // Unlinked generator cards stay local: time_cards requires a real employee FK.
  function saveCard(id: string, patch: Partial<TimeCard>) {
    const card = cards.find(item => item.id === id);
    if (card && !card.employeeId) setCards(items => items.map(item => item.id === id ? { ...item, ...patch } : item));
    else updateTimeCard(id, patch);
  }

  function refresh() {
    setCards(previous => [...getTimeCards(), ...previous.filter(card => !card.employeeId)]);
    setSheets(getClaimSheets());
  }

  function mergeEntries(existing: TimeCardEntry[], incoming: TimeCardEntry[]) {
    const map = new Map(existing.map((e) => [e.date, e]));
    for (const row of incoming) map.set(row.date, { ...map.get(row.date), ...row });
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  async function scanOne(file: File) {
    const uploaded = await uploadToR2(file, "time-cards");
    const ocr = await extractTimeCardData(uploaded.url);
    if (!ocr.ok) throw new Error(ocr.reason);
    return groupTimeCardRows(ocr.data).map((group) => ({
      fileName: file.name, fileUrl: uploaded.url, identity: { ...group.identity, projectName: cardProjectName(group.identity) },
      entries: group.entries.map((r) => ({
        date: r.date,
        workerName: group.identity.workerName,
        employeeCode: group.identity.employeeCode,
        fin: group.identity.fin,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        normalHours: r.normalHours,
        otHours: r.otHours,
        remarks: r.remarks,
        confidence: r.confidence,
        suggestion: r.suggestion,
      })),
    }));
  }

  function openScan(scan: PendingScan) {
    setReviewScan(scan);
    setEmployeeId(matchCardWorker(scoped, scan.identity));
    const matchedSite = uniqueCardMatch(sites, scan.identity.siteName, (site) => [site.name, site.code]);
    setSiteId(matchedSite);
    setSiteName(scan.identity.siteName?.trim() ?? "");
  }

  /** Confirming the first card's Site / Project / Month creates every card in the batch. */
  function confirmScan() {
    if (!reviewScan || !canConfirmCardDetails(employeeId, month, siteName)) return;
    const { start, end } = monthRange(month);
    const projectName = projectId ? projects.find((project) => project.id === projectId)?.name : undefined;
    const makeCard = (scan: PendingScan, workerId: string, site: string, matchedSiteId: string) => {
      const draft: Omit<TimeCard, "id"> = { employeeId: workerId, periodStart: start, periodEnd: end, fileUrl: scan.fileUrl, fileName: scan.fileName, status: "Draft",
        entries: redateToMonth(scan.entries, month).map((entry) => ({ ...entry, projectId: projectId || undefined, projectName, siteId: matchedSiteId || undefined, siteName: site })) };
      return workerId ? addTimeCard(draft) : { ...draft, id: crypto.randomUUID() };
    };
    const created = [makeCard(reviewScan, employeeId, siteName.trim(), siteId)];
    for (const scan of pendingScans) {
      const site = scan.identity.siteName?.trim() || siteName.trim();
      created.push(makeCard(scan, matchCardWorker(scoped, scan.identity), site, uniqueCardMatch(sites, site, (item) => [item.name, item.code])));
    }
    const local = created.filter(card => !card.employeeId);
    if (local.length) setCards(items => [...items, ...local]);
    refresh(); setSelectedId(created[0]!.id); setActiveTab("cards");
    setBatchCardIds(ids => [...ids, ...created.map(card => card.id)]);
    setPendingScans([]);
    setReviewScan(null); setVerificationSearch(""); setVerificationFilter("All"); setVerificationOpen(true);
  }

  async function handleUpload(fileList: FileList | File[] | null) {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;
    setUploading(true);
    setProgress({ done: 0, total: files.length });
    try {
      const scans: PendingScan[] = [];
      let totalRows = 0;
      const failed: string[] = [];
      const pages: File[] = [];
      for (const file of files) {
        try { pages.push(...await splitTimeCardFile(file)); }
        catch (e) { failed.push(`${file.name}: ${e instanceof Error ? e.message : "PDF could not be opened"}`); }
      }
      setProgress({ done: 0, total: pages.length });
      for (const [i, file] of pages.entries()) {
        try {
          const res = await scanOne(file);
          scans.push(...res);
          totalRows += res.reduce((count, scan) => count + scan.entries.length, 0);
        } catch (e) {
          failed.push(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`);
        }
        setProgress({ done: i + 1, total: pages.length });
      }
      refresh();
      const [first, ...rest] = scans;
      setBatchCardIds([]);
      setProjectId("");
      setPendingScans(rest);
      if (first) { setMonth(first.entries[0]?.date.slice(0, 7) ?? ""); openScan(first); }
      if (totalRows > 0) {
        toast.success(`Read ${scans.length} worker card(s), ${totalRows} daily row(s) from ${files.length} file(s)`);
      }
      if (failed.length) toast.message(failed.join(" · "));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  async function rescan(card: TimeCard) {
    if (!card.fileUrl) {
      toast.error("This card has no scanned file");
      return;
    }
    setRescanId(card.id);
    try {
      const ocr = await extractTimeCardData(card.fileUrl);
      if (!ocr.ok) {
        toast.message(ocr.reason || OCR_NOT_CONFIGURED);
        return;
      }
      const groups = groupTimeCardRows(ocr.data);
      const matching = groups.filter(group => matchCardWorker(scoped, group.identity) === card.employeeId && group.entries[0]?.date.slice(0, 7) === card.periodStart.slice(0, 7) && (!card.entries[0]?.siteName || group.identity.siteName?.trim().toUpperCase() === card.entries[0]?.siteName?.trim().toUpperCase()));
      const scan = matching.length === 1 ? matching[0] : groups.length === 1 && !groups[0]?.identity.employeeCode && !groups[0]?.identity.fin && !groups[0]?.identity.workerName ? groups[0] : undefined;
      if (!scan) throw new Error("Could not uniquely match this worker in the source. Upload and review the cards separately.");
      const entries = mergeEntries(
        card.entries,
        scan.entries.map((r) => ({
          date: r.date,
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          confidence: r.confidence,
          suggestion: r.suggestion,
        })),
      );
      saveCard(card.id, { status: "Draft", entries: entries.map(entry => ({ ...entry, normalHours: undefined, otHours: undefined, reviewApproved: false })) });
      refresh();
      setSelectedId(card.id);
      setVerificationOpen(true);
      toast.success(`Auto-filled ${scan.entries.length} row(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rescan failed");
    } finally {
      setRescanId(null);
    }
  }

  function setEntry(date: string, patch: Partial<TimeCardEntry>) {
    if (!selected) return;
    const exists = selected.entries.some((e) => e.date === date);
    const entries = exists
      ? selected.entries.map((e) => (e.date === date ? { ...e, ...patch } : e))
      : [...selected.entries, { date, ...patch }];
    const affectsHours = ["checkIn", "checkOut", "resolution", "normalHours", "otHours"].some(key => key in patch);
    const resetsHours = "checkIn" in patch || "checkOut" in patch || "resolution" in patch;
    saveCard(selected.id, { entries: entries.map(entry => ({ ...entry, ...(affectsHours ? { reviewApproved: false } : {}), ...(resetsHours && entry.date === date ? { normalHours: undefined, otHours: undefined } : {}) })), ...(affectsHours ? { status: "Draft" as const } : {}) });
    refresh();
  }

  function bulkUpdateResolution(resolution: TimeCardEntry["resolution"]) {
    if (!selected) return;
    const entries = [...selected.entries];
    filteredComparison.forEach((r) => {
      const isMismatch =
        r.state === "Mismatch" || r.state === "Missing in system" || r.state === "Missing on card";
      if (isMismatch) {
        const idx = entries.findIndex((e) => e.date === r.date);
        if (idx > -1) {
          // Accept keeps the card's written hours; Correct switches to system attendance.
          entries[idx] = resolution === "Accepted" ? { ...entries[idx], resolution } : { ...entries[idx], resolution, normalHours: undefined, otHours: undefined };
        } else {
          entries.push({ date: r.date, resolution });
        }
      }
    });
    saveCard(selected.id, { status: "Draft", entries: entries.map(entry => ({ ...entry, reviewApproved: false })) });
    refresh();
    toast.success(`Bulk updated ${filteredComparison.length} rows to ${resolution}`);
  }

  function verifyCard(card: TimeCard): boolean {
    if (!validCardHours(card.entries)) { toast.error("GW and OT hours must be non-negative numbers"); return false; }
    const rows = compareTimeCard(card);
    const unresolved = rows.filter((r) => r.state !== "Verified" && !r.resolution).length;
    if (!card.entries.some((e) => e.checkIn || e.checkOut || (e.normalHours ?? 0) > 0 || (e.otHours ?? 0) > 0)) {
      toast.error("This time card has no times yet — scan or enter them first");
      return false;
    }
    saveCard(card.id, { status: unresolved ? "Has Mismatches" : "Verified" });
    if (unresolved) {
      refresh();
      toast.warning(`${unresolved} row(s) still need a decision`);
      return false;
    }
    refresh();
    return true;
  }

  function finalize(card: TimeCard) {
    if (completeTimeCardReview("finalize", () => verifyCard(card), () => {})) {
      setVerificationOpen(false);
      toast.success("Review finalized — ready for approval");
    }
  }

  /** Approving accepts the card's rows as shown (card = source), saves hours and opens the next worker. */
  function approveCard(card: TimeCard) {
    const rows = compareTimeCard(card);
    const entries = card.entries.map(entry => {
      const row = rows.find(item => item.date === entry.date);
      const resolution = entry.resolution ?? (row && row.state !== "Verified" ? "Accepted" as const : undefined);
      return { ...entry, resolution, normalHours: row?.normalHours ?? 0, otHours: row?.otHours ?? 0, reviewApproved: true };
    });
    if (!validCardHours(entries)) { toast.error("GW and OT hours must be non-negative numbers"); return; }
    if (!entries.some(entry => entry.resolution !== "Ignored" && ((entry.normalHours ?? 0) > 0 || (entry.otHours ?? 0) > 0))) {
      toast.error("This time card has no worked hours yet — scan or enter them first");
      return;
    }
    saveCard(card.id, { status: "Verified", entries });
    refresh();
    setVerificationSearch(""); setVerificationFilter("All");
    const order = batchCardIds.length ? batchCardIds : settlementCards.map(item => item.id);
    const nextId = nextBatchCardId(order, card.id, id => { const item = cards.find(c => c.id === id); return !!item && isCardApproved(item); });
    if (nextId) {
      setSelectedId(nextId);
      toast.success(`${cardName(card)} approved — next card opened`);
    } else if (pendingScans.length) {
      setVerificationOpen(false);
      const [next, ...rest] = pendingScans;
      setPendingScans(rest); openScan(next!);
    } else {
      setVerificationOpen(false);
      toast.success("All cards approved — click Generate claim sheet");
    }
  }

  async function generateSettledClaims() {
    const issue = projectBatchIssue(settlementCards.flatMap(card => card.entries), { projects, sites }, true);
    if (issue) { toast.error(issue); return; }
    if (!readyToGenerate || generating) return;
    setGenerating(true);
    try {
      if (settlementCards.some(card => !card.periodStart.startsWith(month))) throw new Error("These cards cover different months. Generate each claim month separately from Time cards.");
      const drafts = preparedClaims.filter(item => item.snapshot.length).map(({ card, snapshot }) => ({
        id: card.id, reference: card.id, employeeId: card.employeeId || undefined,
        companyId: employees.find(employee => employee.id === card.employeeId)?.companyId ?? (companyId || undefined),
        periodStart: card.periodStart, periodEnd: card.periodEnd, totalDays: snapshot.length,
        totalNormalHours: snapshot.reduce((sum, row) => sum + row.normalHours, 0),
        totalOtHours: snapshot.reduce((sum, row) => sum + row.otHours, 0), snapshot,
      }));
      if (!drafts.length) throw new Error("No approved worked hours to claim");
      // Validate the active template before saving any claim records.
      const workbook = await createClaimWorkbook(drafts, employees, getCompanies(), month, { projects: getProjects(), sites: getSites(), clients: getClients() });
      const issues = reconcileClaimWorkbook(workbook, drafts, employees, month);
      setReconcile({ issues, workers: drafts.length });
      if (issues.length) toast.warning(`${issues.length} mismatch(es) between preview and generated sheet — see Claim sheets tab`);
      for (const draft of drafts) {
        const existing = getClaimSheets().find(sheet => sheet.snapshot.some(row => row.sourceCardId === draft.id));
        const { id, reference, ...claim } = draft;
        if (existing) updateClaimSheet(existing.id, claim);
        else addClaimSheet(claim);
      }
      refresh(); setActiveTab("sheets"); setClaimPreviewOpen(false);
      setExcelDocument({ workbook, fileName: timestampedName(`claim_sheet_${month}`, "xlsx") });
      toast.success(`Claim Excel ready — ${drafts.length} approved cards`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Claim generation failed"); }
    finally { setGenerating(false); }
  }

  async function exportSheet(id: string) {
    const sheet = sheets.find((s) => s.id === id);
    if (!sheet) return;
    const sheetMonth = sheet.periodStart.slice(0, 7);
    try {
      await exportCombinedClaims([sheet], employees, "", getCompanies(), sheetMonth, {
        projects: getProjects(),
        sites: getSites(),
        clients: getClients(),
        fileName: timestampedName(`claim_sheet_${sheet.reference}`, "xlsx"),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
    }
  }

  async function editExcel(id?: string) {
    if (editingExcel) return;
    const selectedSheets = id ? sheets.filter(s => s.id === id) : sheets.filter(s => (!companyId || s.companyId === companyId) && (s.periodStart.startsWith(month) || s.periodEnd.startsWith(month)));
    const sheetMonth = id ? selectedSheets[0]?.periodStart.slice(0, 7) ?? month : month;
    setEditingExcel(true);
    try {
      const workbook = await createClaimWorkbook(selectedSheets, employees, getCompanies(), sheetMonth, { projects: getProjects(), sites: getSites(), clients: getClients() });
      setExcelDocument({ workbook, fileName: timestampedName(`claim_sheet_${id ? selectedSheets[0]?.reference ?? sheetMonth : sheetMonth}`, "xlsx") });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open Excel editor");
    } finally { setEditingExcel(false); }
  }

  async function handleImportConfirm(data: any[]) {
    setIsImportOpen(false);
    setImportFile(null);
    if (!data.length) return;

    setUploading(true);
    try {
      const { start, end } = monthRange(month);
      // Group rows by employee to create/update multiple cards if needed
      const byEmployee = new Map<string, any[]>();
      data.forEach((row) => {
        const pFile = String(row["p-file number"] || "").toLowerCase();
        const emp = employees.find((e) => e.employeeCode.toLowerCase() === pFile);
        if (emp) {
          if (!byEmployee.has(emp.id)) byEmployee.set(emp.id, []);
          byEmployee.get(emp.id)?.push(row);
        }
      });

      const importedIds: string[] = [];
      for (const [empId, rows] of byEmployee.entries()) {
        const entries: TimeCardEntry[] = rows.map((r) => ({
          date: r.date,
          checkIn: r["check in"],
          checkOut: r["check out"],
          confidence: 1.0, // Manual import is 100% confident
        }));

        const card = addTimeCard({
          employeeId: empId,
          periodStart: start,
          periodEnd: end,
          status: "Draft",
          entries,
        });
        importedIds.push(card.id);
      }

      refresh();
      setBatchCardIds(importedIds);
      setPendingScans([]); setReviewScan(null);
      if (importedIds[0]) { setSelectedId(importedIds[0]); setActiveTab("cards"); setVerificationOpen(true); }
      toast.success(`Imported ${data.length} rows for ${byEmployee.size} employee(s)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setUploading(false);
    }
  }

  return (

    <AppShell>
      <div className="w-full space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Claim Sheet
          </h1>
          <ClaimTemplateManager />
        </div>

        <section className="space-y-5 rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Generate Claim Sheet</h2>
          </div>
          {(() => {
            const current = !selected ? 1 : readyToGenerate ? 3 : 2;
            const steps = ["Upload time cards", "Check OCR results", "Generate claim sheet"];
            return (
              <ol className="grid gap-2 sm:grid-cols-3">
                {steps.map((label, i) => {
                  const n = i + 1;
                  const done = n < current;
                  const active = n === current;
                  return (
                    <li key={label} className={`flex min-w-0 items-center gap-3 rounded-lg border p-3 ${active ? "border-primary bg-primary/10" : "border-border"}`}>
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-semibold ${done ? "bg-success text-success-foreground" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {done ? <CheckCircle2 className="h-4 w-4" /> : n}
                      </span>
                      <span className={`truncate text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                    </li>
                  );
                })}
              </ol>
            );
          })()}

          <label htmlFor="claim-upload" onDragOver={(event) => { event.preventDefault(); if (!uploading) setIsDragOver(true); }} onDragLeave={() => setIsDragOver(false)} onDrop={(event) => { event.preventDefault(); setIsDragOver(false); if (!uploading && event.dataTransfer?.files?.length) { void handleUpload(event.dataTransfer.files); } }} className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${uploading ? "pointer-events-none border-primary/40 bg-primary/5 opacity-60" : "cursor-pointer"} ${isDragOver ? "border-primary bg-primary/20 scale-[1.01]" : "border-primary/40 bg-primary/5 hover:bg-primary/10"}`}>
            <span className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground"><Upload className="h-6 w-6" /></span>
            <span className="text-base font-semibold text-foreground">{uploading ? (progress ? `Reading cards ${progress.done}/${progress.total}…` : "Reading cards…") : isDragOver ? "Drop the cards here" : "Click or drag time cards here"}</span>
            <span className="text-sm text-muted-foreground">
              {isOcrConfigured() ? "PDF or photos · drag & drop or click · select many at once · details are read automatically" : `${OCR_NOT_CONFIGURED}. Type the card times in manually after upload.`}
            </span>
          </label>
          <input id="claim-upload" className="hidden" type="file" multiple accept="image/*,application/pdf" disabled={uploading || reviewScan !== null || pendingScans.length > 0} onChange={(event) => { void handleUpload(event.target.files); event.target.value = ""; }} />
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>Have an Excel file instead?</span>
            <div className="relative">
              <Button type="button" variant="link" className="h-auto p-0">Import time-card rows</Button>
              <input type="file" className="absolute inset-0 cursor-pointer opacity-0" accept=".xlsx,.xls,.csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setImportFile(file); setIsImportOpen(true); } e.target.value = ""; }} />
            </div>
          </div>

          {batchIssue && <div role="alert" className="border-l-4 border-destructive bg-destructive/10 p-3 text-sm text-foreground">{batchIssue}</div>}
          {selected && <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground">Selected card: {cardName(selected)} · {selected.periodStart} → {selected.periodEnd}</p>
            <div className="grid items-end gap-4 md:grid-cols-2">
            <div className="min-w-0 space-y-2">
              <Label htmlFor="claim-project">Project (optional)</Label>
              <Select value={selected.entries.find((entry) => entry.projectId)?.projectId ?? "none"} onValueChange={(value) => { const id = value === "none" ? undefined : value; saveCard(selected.id, { entries: selected.entries.map((entry) => ({ ...entry, projectId: id, projectName: id ? projects.find((project) => project.id === id)?.name : undefined })) }); setProjectId(id ?? ""); refresh(); }}>
                <SelectTrigger id="claim-project" className="w-full"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No project selected</SelectItem>
                  {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.code} — {project.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {!projects.length && <p className="text-sm text-muted-foreground">No projects available for this company.</p>}
            </div>
            <div className="space-y-2"><Label htmlFor="claim-site">Site</Label><Input id="claim-site" value={selected.entries.find((entry) => entry.siteName)?.siteName ?? sites.find((site) => site.id === selected.entries.find((entry) => entry.siteId)?.siteId)?.name ?? ""} onChange={(event) => { const name = event.target.value; saveCard(selected.id, { status: "Draft", entries: selected.entries.map((entry) => ({ ...entry, siteName: name, siteId: uniqueCardMatch(sites, name, (site) => [site.name, site.code]) || undefined })) }); refresh(); }} /></div>
            <div className="space-y-2">
              <Label htmlFor="claim-month">Claim period</Label>
              <Input id="claim-month" type="month" value={selected.periodStart.slice(0, 7)} readOnly />
            </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setVerificationOpen(true)} className="gap-2"><ScanLine className="h-4 w-4" />Check OCR results</Button>
              <Button disabled={uploading || isCardApproved(selected)} onClick={() => approveCard(selected)} className="gap-2"><CheckCircle2 className="h-4 w-4" />Approve card</Button>
            </div>
          </div>}
          {!selected && cards.length > 0 && <p className="text-center text-sm text-muted-foreground">Or pick a card below and press <span className="font-medium text-foreground">Open</span> to check and approve it.</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <span className="text-sm text-muted-foreground">{approvedCount}/{settlementCards.length + pendingScans.length + (reviewScan ? 1 : 0)} cards approved</span>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!settlementCards.length || uploading || generating} onClick={() => setClaimPreviewOpen(true)} className="gap-2"><Eye className="h-4 w-4" />Preview dates & hours</Button>
              <Button disabled={!readyToGenerate || uploading || generating} onClick={() => setClaimPreviewOpen(true)} className="gap-2"><FileSpreadsheet className="h-4 w-4" />Generate claim sheet</Button>
            </div>
          </div>
        </section>

        <ClaimDatePreview open={claimPreviewOpen} onOpenChange={setClaimPreviewOpen} prepared={preparedClaims} workerName={cardName} workerCode={card => card.entries.find(entry => entry.employeeCode)?.employeeCode || employees.find(employee => employee.id === card.employeeId)?.employeeCode || "—"} ready={readyToGenerate && !uploading} generating={generating} onReview={card => { setClaimPreviewOpen(false); setSelectedId(card.id); setActiveTab("cards"); setVerificationSearch(""); setVerificationFilter("All"); setVerificationOpen(true); }} onGenerate={() => void generateSettledClaims()} />

        <Dialog open={reviewScan !== null} onOpenChange={() => {}}>
          <DialogContent>
            <DialogHeader><DialogTitle>Review extracted card details</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{reviewScan?.fileName} · {reviewScan?.entries.length ?? 0} worked days read{pendingScans.length ? ` · ${pendingScans.length} more worker card(s) in this batch use the same Claim Month and Project` : ""}</p>
            <Label htmlFor="review-site">Site</Label><Input id="review-site" value={siteName} required placeholder="Site name printed on time card" onChange={(event) => { setSiteName(event.target.value); setSiteId(uniqueCardMatch(sites, event.target.value, (site) => [site.name, site.code])); }} />
            <Label>Project/Client Name (optional)</Label><Select value={projectId || "none"} onValueChange={(value) => {
              const id = value === "none" ? "" : value;
              setProjectId(id);
              for (const card of cards.filter(item => batchCardIds.includes(item.id))) saveCard(card.id, { entries: card.entries.map(entry => ({ ...entry, projectId: id || undefined, projectName: id ? projects.find(project => project.id === id)?.name : undefined })) });
              refresh();
            }}><SelectTrigger aria-label="Project/Client Name"><SelectValue placeholder="Select project (optional)" /></SelectTrigger><SelectContent><SelectItem value="none">No project selected</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}{clients.find(client => client.id === project.clientId)?.name ? ` / ${clients.find(client => client.id === project.clientId)?.name}` : ""}</SelectItem>)}</SelectContent></Select>
            <Label htmlFor="review-month">Claim Month</Label><Input id="review-month" type="month" value={month} onChange={event => setMonth(event.target.value)} />
            <Button disabled={!canConfirmCardDetails(employeeId, month, siteName)} onClick={confirmScan}><CheckCircle2 className="mr-2 h-4 w-4" />Confirm & review times</Button>
          </DialogContent>
        </Dialog>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="sheets">Claim sheets</TabsTrigger>
            <TabsTrigger value="cards">Time cards</TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="mt-4 space-y-4">
          <ImportValidationDialog
            file={importFile}
            isOpen={isImportOpen}
            onClose={() => {
              setIsImportOpen(false);
              setImportFile(null);
            }}
            onConfirm={handleImportConfirm}
          />


            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cards.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-32 text-center">
                        <EmptyState
                          className="border-0 bg-transparent"
                          icon={<ScanLine className="h-5 w-5" />}
                          title="No time cards"
                          description="Upload a scanned card to start verification."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    cards.map((c) => (
                      <TableRow
                        key={c.id}
                        className={selectedId === c.id ? "bg-muted/50" : undefined}
                      >
                        <TableCell className="font-medium">{cardName(c)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.periodStart} → {c.periodEnd}
                        </TableCell>
                        <TableCell className="max-w-[14rem] truncate text-sm">
                          {c.fileUrl ? (
                            <a className="underline" href={c.fileUrl} target="_blank" rel="noreferrer">
                              {c.fileName ?? "View"}
                            </a>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            dot
                            label={isCardApproved(c) ? "Approved" : c.status}
                            variant={
                              c.status === "Verified"
                                ? "success"
                                : c.status === "Has Mismatches"
                                  ? "destructive"
                                  : "info"
                            }
                          />
                        </TableCell>
                        <TableCell className="space-x-1 text-right">
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedId(c.id); setVerificationOpen(true); }}>
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={!c.fileUrl || rescanId === c.id}
                            onClick={() => void rescan(c)}
                          >
                            <ScanLine className="mr-1 h-4 w-4" />
                            {rescanId === c.id ? "Scanning…" : "Auto-fill"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              c.employeeId ? deleteTimeCard(c.id) : setCards(items => items.filter(item => item.id !== c.id)); setBatchCardIds(ids => ids.filter(id => id !== c.id));
                              if (selectedId === c.id) setSelectedId(null);
                              refresh();
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <Dialog open={verificationOpen && selected !== null} onOpenChange={open => { setVerificationOpen(open); if (!open) setFocusIssue(null); }}>
            {selected ? (
              <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-6xl">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <DialogHeader><DialogTitle>
                      Verification — {cardName(selected)}
                    </DialogTitle></DialogHeader>
                    {focusIssue && focusIssue.cardId === selected.id && <div className="my-2 grid gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-sm sm:grid-cols-3">
                      <div><span className="text-muted-foreground">Mismatch · {focusIssue.date || "all dates"}</span><p className="font-medium">{focusIssue.kind}</p></div>
                      <div><span className="text-muted-foreground">Preview (approved)</span><p className="font-medium tabular-nums">{focusIssue.expected}</p></div>
                      <div><span className="text-muted-foreground">Generated sheet</span><p className="font-medium tabular-nums">{focusIssue.actual}</p></div>
                    </div>}
                    <p className="text-xs text-muted-foreground">
                      {mismatches} of {comparison.length} rows need attention. GW hrs: {comparison.reduce((sum, row) => sum + row.normalHours, 0).toFixed(2)} · OT hrs: {comparison.reduce((sum, row) => sum + row.otHours, 0).toFixed(2)}
                    </p>
                    {lowConfidenceCount > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7 border-warning/40 text-xs text-warning hover:text-warning"
                        onClick={() => {
                          setVerificationFilter("LowConfidence");
                          setVerificationSearch("");
                          toast.message(
                            `Review queue: ${lowConfidenceCount} low-confidence row(s) below 70%`,
                          );
                        }}
                      >
                        <ScanLine className="mr-1 h-3.5 w-3.5" />
                        Review queue ({lowConfidenceCount} low confidence)
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search date or notes..."
                        className="h-8 w-48 text-xs"
                        value={verificationSearch}
                        onChange={(e) => setVerificationSearch(e.target.value)}
                      />
                      <Select
                        value={verificationFilter}
                        onValueChange={(v: any) => setVerificationFilter(v)}
                      >
                        <SelectTrigger className="h-8 w-32 text-xs">
                          <SelectValue placeholder="Filter" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All">All Rows</SelectItem>
                          <SelectItem value="Mismatch">All Diffs</SelectItem>
                          <SelectItem value="Unresolved">Needs Action</SelectItem>
                          <SelectItem value="LowConfidence">
                            Low Confidence ({lowConfidenceCount})
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <ExportButton
                        rows={comparison.map((r) => ({
                          Date: r.date,
                          "Card In": r.cardIn ?? "",
                          "Card Out": r.cardOut ?? "",
                          "System In": r.systemIn ?? "",
                          "System Out": r.systemOut ?? "",
                          Result: r.state,
                          Resolution: r.resolution ?? "",
                          Notes: r.remarks ?? "",
                        }))}
                        baseName="time_card_verification"
                        sheetName="Verification"
                      />
                      <div className="flex gap-1 border-l pl-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-success hover:text-success"
                          onClick={() => bulkUpdateResolution("Accepted")}
                          disabled={!filteredComparison.some(r => r.state !== "Verified")}
                        >
                          Bulk Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-warning hover:text-warning"
                          onClick={() => bulkUpdateResolution("Corrected")}
                          disabled={!filteredComparison.some(r => r.state !== "Verified")}
                        >
                          Bulk Correct
                        </Button>
                      </div>
                      <Button size="sm" disabled={isCardApproved(selected)} onClick={() => approveCard(selected)}>
                        <CheckCircle2 className="mr-1 h-4 w-4" />Approve card & next
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => finalize(selected)}>
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Finalize
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Comparison (Card vs System)</TableHead>
                        <TableHead>Resolution & Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredComparison.map((r) => {
                        const isMismatch = r.state === "Mismatch" || r.state === "Missing in system" || r.state === "Missing on card";
                        return (
                          <TableRow key={r.date} className={isMismatch ? "bg-destructive/5" : undefined}>
                            <TableCell className="whitespace-nowrap text-sm font-medium">{r.date}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-2 py-1">
                                <div className="grid gap-4 rounded border bg-muted/30 p-2 text-xs lg:grid-cols-2">
                                  <div className="space-y-1">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-bold uppercase text-muted-foreground">
                                        Scanned Card
                                      </span>
                                      {r.confidence !== undefined && (
                                        <div
                                          className={`rounded px-1 text-[9px] font-bold ${
                                            r.confidence > 0.8
                                              ? "bg-success/10 text-success"
                                              : r.confidence > 0.5
                                                ? "bg-warning/10 text-warning"
                                                : "bg-destructive/10 text-destructive"
                                          }`}
                                          title={`OCR Confidence: ${Math.round(r.confidence * 100)}%`}
                                        >
                                          {Math.round(r.confidence * 100)}% Conf.
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex gap-1">
                                      <div className="relative">
                                        <Input
                                          type="time"
                                          className={`h-7 w-24 text-[11px] ${r.confidence !== undefined && r.confidence < 0.7 ? "border-warning" : ""}`}
                                          value={r.cardIn ?? ""}
                                          onChange={(e) => setEntry(r.date, { checkIn: e.target.value })}
                                        />
                                      </div>
                                      <span className="self-center">—</span>
                                      <div className="relative">
                                        <Input
                                          type="time"
                                          className={`h-7 w-24 text-[11px] ${r.confidence !== undefined && r.confidence < 0.7 ? "border-warning" : ""}`}
                                          value={r.cardOut ?? ""}
                                          onChange={(e) => setEntry(r.date, { checkOut: e.target.value })}
                                        />
                                      </div>
                                    </div>
                                    <TimeCardHoursInputs date={r.date} normalHours={r.normalHours} otHours={r.otHours} disabled={r.resolution === "Ignored"} onChange={patch => setEntry(r.date, patch)} />
                                    {r.suggestion && (
                                      <div className="mt-1 flex flex-wrap gap-1 border-t border-dashed pt-1">
                                        <span className="text-[9px] text-muted-foreground">Suggest:</span>
                                        <Button
                                          variant="ghost"
                                          className="h-4 px-1 text-[9px] hover:bg-primary/10"
                                          onClick={() =>
                                            setEntry(r.date, {
                                              checkIn: r.suggestion?.checkIn,
                                              checkOut: r.suggestion?.checkOut,
                                            })
                                          }
                                        >
                                          {r.suggestion.checkIn || "??"} - {r.suggestion.checkOut || "??"}
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="space-y-1 border-l pl-4">
                                    <span className="text-[10px] font-bold uppercase text-muted-foreground">System Attendance</span>
                                    <div className="flex items-center gap-1 font-mono text-[11px]">
                                      <span className={!r.systemIn && r.cardIn ? "text-destructive" : ""}>
                                        {r.systemIn || "--:--"}
                                      </span>
                                      <span className="text-muted-foreground">—</span>
                                      <span className={!r.systemOut && r.cardOut ? "text-destructive" : ""}>
                                        {r.systemOut || "--:--"}
                                      </span>
                                      {isMismatch && (
                                        <div className="ml-auto rounded-full bg-destructive/10 px-1.5 text-[9px] font-bold text-destructive">
                                          DIFF
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex gap-2 text-[10px] text-muted-foreground">
                                      <span>
                                        GW hrs:{" "}
                                        <span className="font-semibold text-foreground">
                                          {r.systemNormalHours ?? "--"}
                                        </span>
                                      </span>
                                      <span>
                                        OT hrs:{" "}
                                        <span className="font-semibold text-foreground">
                                          {r.systemOtHours ?? "--"}
                                        </span>
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <StatusBadge
                                    dot
                                    label={r.state}
                                    variant={
                                      r.state === "Verified"
                                        ? "success"
                                        : r.state === "Mismatch"
                                          ? "destructive"
                                          : "warning"
                                    }
                                    className="shrink-0"
                                  />
                                  <Select
                                    value={r.resolution ?? ""}
                                    onValueChange={(v) =>
                                      setEntry(r.date, {
                                        resolution: v as TimeCardEntry["resolution"],
                                      })
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-full min-w-[140px]">
                                      <SelectValue placeholder="Action Required" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="Accepted">Accept Card (Keep OCR)</SelectItem>
                                      <SelectItem value="Corrected">Use System Time</SelectItem>
                                      <SelectItem value="Ignored">Ignore Entry</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {isMismatch && (
                                  <Input
                                    placeholder="Add reason for adjustment..."
                                    className="h-7 text-[11px]"
                                    value={r.remarks ?? ""}
                                    onChange={(e) => setEntry(r.date, { remarks: e.target.value })}
                                  />
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </DialogContent>
            ) : null}
            </Dialog>
          </TabsContent>

          <TabsContent value="sheets" className="mt-4">
            {reconcile && <div className={`mb-4 rounded-md border p-3 text-sm ${reconcile.issues.length ? "border-destructive/50 bg-destructive/10" : "border-success/50 bg-success/10"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{reconcile.issues.length ? `Preview vs generated sheet: ${reconcile.issues.length} mismatch(es) found` : `Preview vs generated sheet: all dates and hours match (${reconcile.workers} workers)`}</p>
                <Button variant="ghost" size="sm" onClick={() => setReconcile(null)}>Dismiss</Button>
              </div>
              {reconcile.issues.length > 0 && <div className="mt-2 max-h-64 overflow-y-auto"><Table>
                <TableHeader><TableRow><TableHead>Worker</TableHead><TableHead>Date</TableHead><TableHead>Issue</TableHead><TableHead>Preview</TableHead><TableHead>Sheet</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>{reconcile.issues.map((i, n) => <TableRow key={n}><TableCell>{i.worker}</TableCell><TableCell className="whitespace-nowrap">{i.date || "—"}</TableCell><TableCell>{i.kind}</TableCell><TableCell>{i.expected}</TableCell><TableCell>{i.actual}</TableCell><TableCell>{i.cardId && cards.some(c => c.id === i.cardId) ? <Button variant="outline" size="sm" onClick={() => { setFocusIssue(i); setSelectedId(i.cardId!); setVerificationSearch(i.date); setVerificationFilter("All"); setVerificationOpen(true); }}>Open card entries</Button> : <span className="text-muted-foreground">Card unavailable</span>}</TableCell></TableRow>)}</TableBody>
              </Table></div>}
            </div>}
            <div className="mb-4 flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" disabled={!sheets.length || editingExcel} onClick={() => void editExcel()}><Pencil className="h-4 w-4" />Edit Excel</Button>
            <Button variant="outline" className="gap-2" disabled={!sheets.length} onClick={() => void exportCombinedClaims(sheets.filter((sheet) => (!companyId || sheet.companyId === companyId) && (sheet.periodStart.startsWith(month) || sheet.periodEnd.startsWith(month))), employees, claimSheetTitle(getCompanies().find((c) => c.id === companyId)?.name ?? "ALL COMPANIES", month), getCompanies(), month, { projects: getProjects(), sites: getSites(), clients: getClients() }).catch((error) => toast.error(error instanceof Error ? error.message : "Download failed"))}><Download className="h-4 w-4" />Download claim sheet (Excel)</Button>
            </div>
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Normal hrs</TableHead>
                    <TableHead>OT hrs</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sheets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32 text-center">
                        <EmptyState
                          className="border-0 bg-transparent"
                          icon={<FileSpreadsheet className="h-5 w-5" />}
                          title="No claim sheets"
                          description="Generate one from verified attendance."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    sheets.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.reference}</TableCell>
                        <TableCell>{empName(s.employeeId)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.periodStart} → {s.periodEnd}
                        </TableCell>
                        <TableCell>{s.totalDays}</TableCell>
                        <TableCell>{s.totalNormalHours.toFixed(1)}</TableCell>
                        <TableCell>{s.totalOtHours.toFixed(1)}</TableCell>
                        <TableCell className="space-x-1 text-right">
                          <Button size="sm" variant="outline" className="gap-1" disabled={editingExcel} onClick={() => void editExcel(s.id)}><Pencil className="h-4 w-4" />Edit</Button>
                          <Button size="sm" variant="outline" className="gap-1" onClick={() => void exportSheet(s.id)}>
                            <Download className="h-4 w-4" />Download
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              deleteClaimSheet(s.id);
                              refresh();
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
        <ClaimWorkbookEditor document={excelDocument} onClose={() => setExcelDocument(null)} />
      </div>
    </AppShell>
  );
}