import { useState } from "react";
import { Download, Upload, FileSpreadsheet, FileDown, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  downloadTemplate,
  downloadDemoSheet,
  exportCsv,
  exportRows,
  pick,
  readSpreadsheet,
  timestampedName,
  type ImportColumn,
} from "@/lib/xlsx";
import { autoMapColumns } from "@/lib/ocr";

export function ExportButton({
  rows,
  loadRows,
  baseName,
  sheetName,
  label = "Export",
  size = "sm",
}: {
  rows: Record<string, unknown>[];
  loadRows?: () => Promise<Record<string, unknown>[]>;
  baseName: string;
  sheetName?: string;
  label?: string;
  size?: "sm" | "default";
}) {
  async function run(kind: "xlsx" | "csv") {
    try {
    const completeRows = loadRows ? await loadRows() : rows;
    if (!completeRows.length) {
      toast.error("Nothing to export", { description: "No rows match the current filters." });
      return;
    }
      if (kind === "xlsx") {
        await exportRows(completeRows, timestampedName(baseName, "xlsx"), sheetName ?? baseName);
      } else {
        await exportCsv(completeRows, timestampedName(baseName, "csv"));
      }
      toast.success(`Exported ${completeRows.length} row${completeRows.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("Export failed", { description: "Could not generate the file." });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant="outline">
          <Download className="mr-1 h-4 w-4" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => run("xlsx")}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("csv")}>
          <FileDown className="mr-2 h-4 w-4" />
          CSV (.csv)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type ImportResult = { imported: number; errors: string[] };

export function ImportDialog({
  title,
  description,
  columns,
  templateName,
  onImport,
  onDone,
  label = "Import",
  mappable = false,
  demoRows,
}: {
  title: string;
  description: string;
  columns: ImportColumn[];
  templateName: string;
  onImport: (rows: Record<string, string>[]) => ImportResult;
  onDone?: () => void;
  label?: string;
  /** Show a column-mapping step so any spreadsheet layout can be imported. */
  mappable?: boolean;
  /** Optional pre-filled example rows offered as a downloadable demo sheet. */
  demoRows?: Record<string, string>[];
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [aiMapping, setAiMapping] = useState(false);

  /** Ask the AI to match the spreadsheet headers to our fields. */
  async function runAiMapping() {
    if (!headers.length) return;
    setAiMapping(true);
    const result = await autoMapColumns(headers, columns.map((c) => c.key));
    setAiMapping(false);
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    const valid: Record<string, string> = {};
    for (const [key, header] of Object.entries(result.data)) {
      if (columns.some((c) => c.key === key) && headers.includes(header)) valid[key] = header;
    }
    if (!Object.keys(valid).length) {
      toast.error("Could not match the columns — map them manually");
      return;
    }
    setMapping((prev) => ({ ...prev, ...valid }));
    toast.success(`${Object.keys(valid).length} column(s) matched — please review`);
  }

  function reset() {
    setRows([]);
    setFileName("");
    setIssues([]);
    setHeaders([]);
    setMapping({});
  }

  const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  /** Rows re-keyed to the system column labels using the current mapping. */
  function mapRows(source: Record<string, string>[]) {
    if (!mappable) return source;
    return source.map((row) => {
      const out: Record<string, string> = {};
      for (const column of columns) {
        const header = mapping[column.key];
        out[column.label.trim().toLowerCase()] = header ? (row[header] ?? "") : "";
      }
      return out;
    });
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await readSpreadsheet(file);
      const problems: string[] = [];
      if (!parsed.length) problems.push("The file has no data rows.");
      const detected = Object.keys(parsed[0] ?? {});
      setHeaders(detected);
      if (mappable) {
        const guess: Record<string, string> = {};
        for (const column of columns) {
          const hit = detected.find((h) => norm(h) === norm(column.label))
            ?? detected.find((h) => norm(h) === norm(column.key));
          if (hit) guess[column.key] = hit;
        }
        setMapping(guess);
        setRows(parsed);
        setFileName(file.name);
        setIssues(parsed.length ? [] : problems);
        return;
      }
      const missing = columns
        .filter((column) => column.required)
        .filter((column) => parsed.length > 0 && !(column.label.trim().toLowerCase() in parsed[0]));
      for (const column of missing) problems.push(`Missing required column: "${column.label}"`);
      parsed.forEach((row, index) => {
        for (const column of columns) {
          if (column.required && !pick(row, column)) {
            problems.push(`Row ${index + 2}: "${column.label}" is empty`);
          }
        }
      });
      setRows(parsed);
      setFileName(file.name);
      setIssues(problems.slice(0, 12));
    } catch {
      toast.error("Could not read the file", { description: "Use .xlsx, .xls or .csv." });
      reset();
    } finally {
      setBusy(false);
    }
  }

  function confirmImport() {
    const source = mapRows(rows);
    const valid = source.filter((row) =>
      columns.filter((c) => c.required).every((c) => pick(row, c)),
    );
    if (!valid.length) {
      toast.error("No valid rows to import", {
        description: mappable ? "Check the column mapping for required fields." : undefined,
      });
      return;
    }
    const result = onImport(valid);
    if (result.imported > 0) {
      toast.success(`Imported ${result.imported} row${result.imported === 1 ? "" : "s"}`, {
        description: result.errors.length ? `${result.errors.length} row(s) skipped.` : undefined,
      });
    } else {
      toast.error("Nothing imported", { description: result.errors[0] });
    }
    setOpen(false);
    reset();
    onDone?.();
  }

  const preview = mapRows(rows).slice(0, 5);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Upload className="mr-1 h-4 w-4" />
        {label}
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadTemplate(columns, `${templateName}_template.xlsx`)}
            >
              <FileSpreadsheet className="mr-1 h-4 w-4" />
              Download template
            </Button>
            {demoRows?.length ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  downloadDemoSheet(columns, demoRows, `${templateName}_demo.xlsx`, "Demo")
                }
              >
                <FileDown className="mr-1 h-4 w-4" />
                Download demo sheet (filled)
              </Button>
            ) : null}
            <span className="text-xs text-muted-foreground">
              Required columns: {columns.filter((c) => c.required).map((c) => c.label).join(", ")}
            </span>
          </div>

          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={busy}
            onChange={(event) => handleFile(event.target.files?.[0])}
          />

          {fileName ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{fileName}</span> — {rows.length} row(s) detected
            </p>
          ) : null}

          {mappable && headers.length ? (
            <div className="rounded-lg border p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  Map spreadsheet columns → system fields
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={aiMapping}
                  onClick={() => void runAiMapping()}
                >
                  <Sparkles className={aiMapping ? "mr-1 h-4 w-4 animate-pulse" : "mr-1 h-4 w-4"} />
                  {aiMapping ? "Matching…" : "AI auto-map"}
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {columns.map((column) => (
                  <label key={column.key} className="flex items-center gap-2 text-xs">
                    <span className="w-36 shrink-0 truncate">
                      {column.label}
                      {column.required ? <span className="text-destructive"> *</span> : null}
                    </span>
                    <select
                      className="h-8 flex-1 rounded-md border bg-background px-2 text-xs"
                      value={mapping[column.key] ?? ""}
                      onChange={(event) =>
                        setMapping((prev) => ({ ...prev, [column.key]: event.target.value }))
                      }
                    >
                      <option value="">— not mapped —</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {issues.length ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Issues found ({issues.length})
              </p>
              <ul className="mt-2 space-y-1 text-xs text-destructive">
                {issues.map((issue) => (
                  <li key={issue}>• {issue}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {preview.length ? (
            <div className="rounded-lg border">
              <div className="flex items-center gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Preview (first {preview.length} of {rows.length})
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {columns.map((column) => (
                        <TableHead key={column.key} className="whitespace-nowrap text-xs">
                          {column.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, index) => (
                      <TableRow key={index}>
                        {columns.map((column) => (
                          <TableCell key={column.key} className="whitespace-nowrap text-xs">
                            {pick(row, column) || "—"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={confirmImport} disabled={!rows.length || busy}>
            Import {rows.length ? `${rows.length} row(s)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}