import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FileDown, FileSpreadsheet, ScanLine, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { ImportValidationDialog } from "@/components/verification/import-validation-dialog";


import { AppShell } from "@/components/app-shell";
import { SummaryCard } from "@/components/ui/summary-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { exportRows, timestampedName } from "@/lib/xlsx";
import { downloadClaimSheetPdf } from "@/lib/pdf";
import { uploadToR2 } from "@/lib/r2";
import { extractTimeCardData, OCR_NOT_CONFIGURED, isOcrConfigured } from "@/lib/ocr";
import {
  addClaimSheet,
  addTimeCard,
  buildClaimSheetRows,
  compareTimeCard,
  deleteClaimSheet,
  deleteTimeCard,
  getClaimSheets,
  getCurrentCompany,
  getEmployees,
  getTimeCards,
  updateTimeCard,
} from "@/lib/store";
import type { TimeCard, TimeCardEntry } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/time-cards")({
  head: () => ({
    meta: [
      { title: "Time Cards & Claim Sheets — BSM Workforce" },
      {
        name: "description",
        content:
          "Upload physical time cards, verify them against system attendance and generate claim sheets.",
      },
      { property: "og:title", content: "Time Cards & Claim Sheets — BSM Workforce" },
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
  const start = `${month}-01`;
  const d = new Date(`${month}-01T00:00:00`);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return { start, end: d.toISOString().slice(0, 10) };
}

function TimeCardsPage() {
  const employees = getEmployees();
  const companyId = getCurrentCompany();
  const scoped = employees.filter((e) => !companyId || e.companyId === companyId);

  const [cards, setCards] = useState(getTimeCards());
  const [sheets, setSheets] = useState(getClaimSheets());
  const [employeeId, setEmployeeId] = useState(scoped[0]?.id ?? "");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [rescanId, setRescanId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [verificationSearch, setVerificationSearch] = useState("");
  const [verificationFilter, setVerificationFilter] = useState<
    "All" | "Mismatch" | "Unresolved" | "LowConfidence"
    >("All");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);


  const LOW_CONFIDENCE = 0.7;

  const selected = cards.find((c) => c.id === selectedId) ?? null;
  const comparison = useMemo(() => (selected ? compareTimeCard(selected) : []), [selected]);
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

  function refresh() {
    setCards(getTimeCards());
    setSheets(getClaimSheets());
  }

  function mergeEntries(existing: TimeCardEntry[], incoming: TimeCardEntry[]) {
    const map = new Map(existing.map((e) => [e.date, e]));
    for (const row of incoming) map.set(row.date, { ...map.get(row.date), ...row });
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  async function scanOne(file: File) {
    const { start, end } = monthRange(month);
    const uploaded = await uploadToR2(file, "time-cards", undefined, employeeId);
    let entries: TimeCardEntry[] = [];
    const ocr = await extractTimeCardData(uploaded.url);
    if (ocr.ok) {
      entries = ocr.data.map((r) => ({
        date: r.date,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        confidence: r.confidence,
      }));
    }
    const card = addTimeCard({
      employeeId,
      periodStart: start,
      periodEnd: end,
      fileUrl: uploaded.url,
      fileName: file.name,
      status: "Draft",
      entries,
    });
    return { card, rows: entries.length, reason: ocr.ok ? null : ocr.reason || OCR_NOT_CONFIGURED };
  }

  async function handleUpload(fileList: FileList | null) {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;
    if (!employeeId) {
      toast.error("Select an employee first");
      return;
    }
    setUploading(true);
    setProgress({ done: 0, total: files.length });
    try {
      let lastId: string | null = null;
      let totalRows = 0;
      const failed: string[] = [];
      for (const [i, file] of files.entries()) {
        try {
          const res = await scanOne(file);
          lastId = res.card.id;
          totalRows += res.rows;
          if (res.reason) failed.push(`${file.name}: ${res.reason}`);
        } catch (e) {
          failed.push(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`);
        }
        setProgress({ done: i + 1, total: files.length });
      }
      refresh();
      if (lastId) setSelectedId(lastId);
      if (totalRows > 0) {
        toast.success(`Scanned ${totalRows} row(s) from ${files.length} card(s)`);
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
      const entries = mergeEntries(
        card.entries,
        ocr.data.map((r) => ({
          date: r.date,
          checkIn: r.checkIn,
          checkOut: r.checkOut,
          confidence: r.confidence,
        })),
      );
      updateTimeCard(card.id, { entries });
      refresh();
      setSelectedId(card.id);
      toast.success(`Auto-filled ${ocr.data.length} row(s)`);
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
    updateTimeCard(selected.id, { entries });
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
          entries[idx] = { ...entries[idx], resolution };
        } else {
          entries.push({ date: r.date, resolution });
        }
      }
    });
    updateTimeCard(selected.id, { entries });
    refresh();
    toast.success(`Bulk updated ${filteredComparison.length} rows to ${resolution}`);
  }

  function finalize(card: TimeCard) {
    const rows = compareTimeCard(card);
    const unresolved = rows.filter((r) => r.state !== "Verified" && !r.resolution).length;
    updateTimeCard(card.id, { status: unresolved ? "Has Mismatches" : "Verified" });
    refresh();
    toast[unresolved ? "warning" : "success"](
      unresolved ? `${unresolved} row(s) still need a decision` : "Time card verified",
    );
  }

  function generateClaimSheet() {
    if (!employeeId) {
      toast.error("Select an employee first");
      return;
    }
    const { start, end } = monthRange(month);
    const snapshot = buildClaimSheetRows(employeeId, start, end);
    if (!snapshot.length) {
      toast.error("No attendance in this period");
      return;
    }
    const sheet = addClaimSheet({
      employeeId,
      companyId: employees.find((e) => e.id === employeeId)?.companyId,
      periodStart: start,
      periodEnd: end,
      totalDays: snapshot.length,
      totalNormalHours: snapshot.reduce((s, r) => s + r.normalHours, 0),
      totalOtHours: snapshot.reduce((s, r) => s + r.otHours, 0),
      snapshot,
    });
    refresh();
    toast.success(`Claim sheet ${sheet.reference} generated`);
  }

  async function exportSheet(id: string) {
    const sheet = sheets.find((s) => s.id === id);
    if (!sheet) return;
    await exportRows(
      sheet.snapshot.map((r) => ({
        Date: r.date,
        Site: r.site ?? "",
        Status: r.status,
        "Check In": r.checkIn ?? "",
        "Check Out": r.checkOut ?? "",
        "Normal Hours": r.normalHours,
        "OT Hours": r.otHours,
      })),
      timestampedName(`claim_sheet_${sheet.reference}`, "xlsx"),
      "Claim Sheet",
    );
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

      let lastId: string | null = null;
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
        lastId = card.id;
      }

      refresh();
      if (lastId) setSelectedId(lastId);
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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Claim Sheets & Mismatch Verification
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload the physical 30-day card or claim sheets, verify them against system attendance, then issue the
            final billing claim sheet.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard title="Time cards" value={cards.length.toString()} icon={<ScanLine className="h-5 w-5" />} variant="info" />
          <SummaryCard title="Verified" value={cards.filter((c) => c.status === "Verified").length.toString()} icon={<CheckCircle2 className="h-5 w-5" />} variant="success" />
          <SummaryCard title="With mismatches" value={cards.filter((c) => c.status === "Has Mismatches").length.toString()} icon={<ScanLine className="h-5 w-5" />} variant="destructive" />
          <SummaryCard title="Claim sheets" value={sheets.length.toString()} icon={<FileSpreadsheet className="h-5 w-5" />} variant="warning" />
        </div>

        <div className="grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {scoped.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} ({e.employeeCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tc-month">Period (month)</Label>
            <Input id="tc-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tc-file">Scanned time card</Label>
            <Input
              id="tc-file"
              type="file"
              multiple
              accept="image/*,application/pdf"
              disabled={uploading}
              onChange={(e) => {
                void handleUpload(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
          <div className="flex items-end gap-2">
            <div className="grid w-full gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" onClick={generateClaimSheet}>
                <FileSpreadsheet className="mr-1 h-4 w-4" />
                Generate claim sheet
              </Button>
              <div className="relative">
                <Button type="button" variant="secondary" className="w-full">
                  <Upload className="mr-1 h-4 w-4" />
                  Import Claim Sheet
                </Button>
                <input
                  type="file"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImportFile(file);
                      setIsImportOpen(true);
                    }
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
          </div>

          <ImportValidationDialog
            file={importFile}
            isOpen={isImportOpen}
            onClose={() => {
              setIsImportOpen(false);
              setImportFile(null);
            }}
            onConfirm={handleImportConfirm}
          />

          <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">
            {uploading ? (
              <span className="inline-flex items-center gap-1">
                <Upload className="h-3 w-3 animate-pulse" />
                {progress
                  ? `Scanning ${progress.done}/${progress.total} card(s)…`
                  : "Uploading…"}
              </span>
            ) : isOcrConfigured() ? (
              "Select one or more scanned cards — each is uploaded and auto-filled by OCR. Check every row before verifying."
            ) : (
              `${OCR_NOT_CONFIGURED}. Type the card times into the grid below — verification works the same way.`
            )}
          </p>
        </div>

        <Tabs defaultValue="cards">
          <TabsList>
            <TabsTrigger value="cards">Time cards</TabsTrigger>
            <TabsTrigger value="sheets">Claim sheets</TabsTrigger>
          </TabsList>

          <TabsContent value="cards" className="mt-4 space-y-4">
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
                        <TableCell className="font-medium">{empName(c.employeeId)}</TableCell>
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
                            label={c.status}
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
                          <Button size="sm" variant="ghost" onClick={() => setSelectedId(c.id)}>
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
                              deleteTimeCard(c.id);
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

            {selected ? (
              <div className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-medium">
                      Verification — {empName(selected.employeeId)}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {mismatches} of {comparison.length} rows need attention.
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
                      <Button size="sm" onClick={() => finalize(selected)}>
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
                                <div className="grid grid-cols-2 gap-4 rounded border bg-muted/30 p-2 text-xs">
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
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="sheets" className="mt-4">
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
                          <Button size="sm" variant="ghost" onClick={() => void exportSheet(s.id)}>
                            Export
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Download PDF"
                            onClick={() =>
                              void downloadClaimSheetPdf(s, {
                                employeeName: empName(s.employeeId),
                              }).then(() => toast.success("Claim sheet PDF downloaded"))
                            }
                          >
                            <FileDown className="h-4 w-4" />
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
      </div>
    </AppShell>
  );
}