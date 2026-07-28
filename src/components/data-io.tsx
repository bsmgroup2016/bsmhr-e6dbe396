import { useState } from "react";
import { Download, Upload, FileSpreadsheet, FileDown, CheckCircle2, AlertTriangle } from "lucide-react";
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
  exportCsv,
  exportRows,
  pick,
  readSpreadsheet,
  timestampedName,
  type ImportColumn,
} from "@/lib/xlsx";

export function ExportButton({
  rows,
  baseName,
  sheetName,
  label = "Export",
  size = "sm",
}: {
  rows: Record<string, unknown>[];
  baseName: string;
  sheetName?: string;
  label?: string;
  size?: "sm" | "default";
}) {
  async function run(kind: "xlsx" | "csv") {
    if (!rows.length) {
      toast.error("Nothing to export", { description: "No rows match the current filters." });
      return;
    }
    try {
      if (kind === "xlsx") {
        await exportRows(rows, timestampedName(baseName, "xlsx"), sheetName ?? baseName);
      } else {
        await exportCsv(rows, timestampedName(baseName, "csv"));
      }
      toast.success(`Exported ${rows.length} row${rows.length === 1 ? "" : "s"}`);
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
}: {
  title: string;
  description: string;
  columns: ImportColumn[];
  templateName: string;
  onImport: (rows: Record<string, string>[]) => ImportResult;
  onDone?: () => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function reset() {
    setRows([]);
    setFileName("");
    setIssues([]);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const parsed = await readSpreadsheet(file);
      const problems: string[] = [];
      if (!parsed.length) problems.push("The file has no data rows.");
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
    const valid = rows.filter((row) =>
      columns.filter((c) => c.required).every((c) => pick(row, c)),
    );
    if (!valid.length) {
      toast.error("No valid rows to import");
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

  const preview = rows.slice(0, 5);

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