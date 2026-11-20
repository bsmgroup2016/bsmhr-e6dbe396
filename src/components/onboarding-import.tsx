import { useState } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadTemplate, type ImportColumn } from "@/lib/xlsx";
import type { ImportResult } from "@/components/data-io";

type Sheet = { name: string; grid: string[][]; startRow: number };
const normal = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function OnboardingImport({ columns, onImport }: { columns: ImportColumn[]; onImport: (rows: Record<string, string>[]) => Promise<ImportResult> }) {
  const [open, setOpen] = useState(false);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [headerIndex, setHeaderIndex] = useState(0);
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const sheet = sheets[sheetIndex];
  const headers = sheet?.grid[headerIndex] ?? [];
  const rows = (sheet?.grid.slice(headerIndex + 1) ?? []).flatMap((cells, index) => {
    if (cells.every(cell => !cell.trim())) return [];
    const values = Object.fromEntries(columns.map(c => [c.label.toLowerCase(), mapping[c.key] == null ? "" : cells[mapping[c.key]] ?? ""]));
    const errors = columns.filter(c => c.required && !values[c.label.toLowerCase()]).map(c => `${c.label} is required`);
    return [{ record: (sheet?.startRow ?? 1) + headerIndex + index + 1, values, errors }];
  });
  const valid = rows.filter(r => !r.errors.length);
  function choose(index: number, header: number, source = sheets) {
    setSheetIndex(index); setHeaderIndex(header); setIssues([]);
    const headings = source[index]?.grid[header] ?? [];
    setMapping(Object.fromEntries(columns.flatMap(c => { const i = headings.findIndex(h => [c.label, c.key].some(k => normal(k) === normal(h))); return i < 0 ? [] : [[c.key, i]]; })));
  }
  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true); setIssues([]);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("Maximum spreadsheet size is 10 MB");
      const XLSX = await import("xlsx");
      const book = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const parsed = book.SheetNames.map(name => {
        const ws = book.Sheets[name]; const ref = ws["!ref"];
        if (!ref) return { name, grid: [], startRow: 1 };
        const range = XLSX.utils.decode_range(ref);
        if (range.e.r - range.s.r > 501 || range.e.c - range.s.c > 100) throw new Error("Use up to 500 workers and 100 columns per sheet");
        const grid: string[][] = [];
        for (let r = range.s.r; r <= range.e.r; r++) {
          const cells: string[] = [];
          for (let c = range.s.c; c <= range.e.c; c++) {
            const cell = ws[XLSX.utils.encode_cell({ r, c })];
            cells.push(cell?.v instanceof Date ? cell.v.toISOString().slice(0, 10) : String(cell?.w ?? cell?.v ?? "").trim());
          }
          grid.push(cells);
        }
        return { name, grid, startRow: range.s.r + 1 };
      });
      setSheets(parsed); choose(0, 0, parsed);
    } catch (error) { setSheets([]); setIssues([error instanceof Error ? error.message : "Could not read spreadsheet"]); }
    finally { setBusy(false); }
  }
  async function confirm() {
    setBusy(true); setIssues([]);
    try {
      const result = await onImport(valid.map(r => r.values));
      const rejected = rows.filter(r => r.errors.length).map(r => `Row ${r.record}: ${r.errors.join(", ")}`);
      setIssues([...rejected, ...result.errors]);
      toast[result.imported ? "success" : "error"](`${result.imported} workers saved, ${rows.length - result.imported} skipped`);
      if (result.imported === rows.length) { setOpen(false); setSheets([]); }
    } catch (error) { setIssues([error instanceof Error ? error.message : "Import failed"]); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}><Button variant="outline" size="sm" onClick={() => setOpen(true)}><Upload className="mr-2 size-4" />Upload XLSX</Button><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Import onboarding workers</DialogTitle></DialogHeader>
    <Button variant="outline" size="sm" onClick={() => void downloadTemplate(columns, "onboarding_template.xlsx")}><Download className="mr-2 size-4" />Download template</Button>
    <Input type="file" aria-label="Onboarding spreadsheet" accept=".xlsx,.xls,.csv" disabled={busy} onChange={e => void upload(e.target.files?.[0])} />
    {sheet && <><div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><Label>Worksheet</Label><Select value={String(sheetIndex)} onValueChange={v => choose(Number(v), 0)}><SelectTrigger aria-label="Worksheet"><SelectValue /></SelectTrigger><SelectContent>{sheets.map((s, i) => <SelectItem key={i} value={String(i)}>{s.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="import-header">Header row</Label><Input id="import-header" type="number" min={sheet.startRow} max={sheet.startRow + sheet.grid.length - 1} value={sheet.startRow + headerIndex} onChange={e => { const value = Number(e.target.value) - sheet.startRow; if (value >= 0 && value < sheet.grid.length) choose(sheetIndex, value); }} /></div></div>
    <div className="grid gap-3 sm:grid-cols-2">{columns.map(c => <div key={c.key} className="space-y-1"><Label>{c.label}{c.required ? " *" : ""}</Label><Select value={mapping[c.key] == null ? "none" : String(mapping[c.key])} onValueChange={v => setMapping(m => { const next = { ...m }; if (v === "none") delete next[c.key]; else next[c.key] = Number(v); return next; })}><SelectTrigger aria-label={`Map ${c.label}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not imported</SelectItem>{headers.map((h, i) => <SelectItem key={i} value={String(i)}>Column {i + 1}: {h || "(blank)"}</SelectItem>)}</SelectContent></Select></div>)}</div>
    <p className="text-sm font-medium">{rows.length} records · {valid.length} ready · {rows.length - valid.length} invalid</p><div className="overflow-x-auto rounded-lg border"><table className="w-full text-sm"><thead><tr>{["Row", "Worker Name", "Company", "Stage", "Validation"].map(h => <th key={h} className="p-2 text-left">{h}</th>)}</tr></thead><tbody>{rows.slice(0, 5).map(r => <tr key={r.record} className="border-t"><td className="p-2">{r.record}</td><td className="p-2">{r.values["worker name"]}</td><td className="p-2">{r.values.company}</td><td className="p-2">{r.values.stage || "IPA registered"}</td><td className="p-2">{r.errors.join(", ") || "Ready"}</td></tr>)}</tbody></table></div></>}
    {issues.length > 0 && <div role="alert" className="space-y-1 text-sm text-destructive">{issues.map((issue, i) => <p key={i}>{issue}</p>)}</div>}
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy || !valid.length} onClick={() => void confirm()}>{busy ? "Importing…" : `Import ${valid.length} workers`}</Button></div>
  </DialogContent></Dialog>;
}