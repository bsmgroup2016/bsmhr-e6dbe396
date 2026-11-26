import { useMemo, useState } from "react";
import type { Workbook, Worksheet } from "exceljs";
import { AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { claimExpansion, claimWorkbookBlob, downloadClaimBlob } from "@/lib/combined-claim-export";
import { claimTemplateLayout } from "@/core/claim-template";
import { createEvaluator } from "@/core/claim-formula-eval";

export interface ClaimPreviewDocument { workbook: Workbook; fileName: string }

const fmt = (v: unknown) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(2)) : v == null ? "" : String(v));
const fmtCell = (v: unknown, numFmt?: string) => {
  if (typeof v !== "number" || !numFmt || !/d/i.test(numFmt) || v < 20000 || v > 80000) return fmt(v);
  const date = new Date(Math.round(v - 25569) * 86400000);
  if (/mmm/i.test(numFmt)) return `${date.getUTCDate()}-${date.toLocaleString("en-SG", { month: "short", timeZone: "UTC" })}`;
  return String(date.getUTCDate());
};

function analyse(sheet: Worksheet) {
  const ev = createEvaluator((r, c) => {
    const cell = sheet.getCell(r, c);
    const value = cell.value && typeof cell.value === "object" && "richText" in cell.value ? cell.text : cell.value;
    return { formula: cell.formula || undefined, value };
  });
  const errors: { address: string; formula: string; result: string }[] = [];
  for (let r = 1; r <= sheet.rowCount; r++) for (let c = 1; c <= sheet.columnCount; c++) {
    const cell = sheet.getCell(r, c);
    if (!cell.formula) continue;
    const v = ev.cellValue(r, c);
    if (ev.isError(v)) errors.push({ address: cell.address, formula: cell.formula, result: v as string });
  }
  let layout: ReturnType<typeof claimTemplateLayout> | null = null;
  try { layout = claimTemplateLayout(sheet); } catch { /* not a claim page */ }
  let g = 0, ot = 0, filled = 0;
  if (layout) for (const s of layout.slots) {
    const code = String(sheet.getCell(s.g, layout.codeCol).value ?? "").trim();
    if (code || String(sheet.getCell(s.g, layout.nameCol).value ?? "").trim()) filled++;
    for (const col of layout.days.values()) {
      const a = Number(sheet.getCell(s.g, col).value), b = Number(sheet.getCell(s.ot, col).value);
      if (Number.isFinite(a)) g += a; if (Number.isFinite(b)) ot += b;
    }
  }
  return { ev, errors, layout, g, ot, filled };
}

export function ClaimWorkbookPreview({ document, onClose, inline = false }: { document: ClaimPreviewDocument | null; onClose: () => void; inline?: boolean }) {
  const [index, setIndex] = useState(0);
  const sheet = document?.workbook.worksheets[index];
  const info = useMemo(() => (sheet ? analyse(sheet) : null), [sheet]);
  const exp = sheet ? claimExpansion.get(sheet) : undefined;
  const rows = sheet ? Array.from({ length: sheet.rowCount }, (_, i) => i + 1).filter((r) => !sheet.getRow(r).hidden) : [];
  const cols = sheet ? Array.from({ length: sheet.columnCount }, (_, i) => i + 1).filter((c) => !sheet.getColumn(c).hidden) : [];
  const added = (r: number) => !!exp && exp.added > 0 && r >= exp.firstAddedRow && r < exp.firstAddedRow + exp.added * 2;

  async function download() {
    if (!document) return;
    try { downloadClaimBlob(await claimWorkbookBlob(document.workbook), document.fileName); toast.success("Claim sheet downloaded"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Download failed"); }
  }

  const content = <>
    {inline ? <div>
      <h2 className="text-lg font-semibold">Preview claim sheet</h2>
      <p className="text-sm text-muted-foreground">Check worker rows, formulas and totals before downloading. Values are calculated here; Excel recalculates on open.</p>
    </div> : <DialogHeader className="pr-8">
      <DialogTitle>Preview claim sheet</DialogTitle>
      <DialogDescription>Check worker rows, formulas and totals before downloading. Values are calculated here; Excel recalculates on open.</DialogDescription>
    </DialogHeader>}
    {info && <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="rounded border px-2 py-1">Workers: <b>{info.filled}</b>{exp ? ` / template slots ${exp.templateSlots}` : ""}</span>
      {exp && exp.added > 0 && <span className="rounded border border-primary/40 bg-primary/10 px-2 py-1 text-primary">+{exp.added} worker rows added (rows {exp.firstAddedRow}–{exp.firstAddedRow + exp.added * 2 - 1})</span>}
      <span className="rounded border px-2 py-1">G-HRS entered: <b>{fmt(info.g)}</b></span>
      <span className="rounded border px-2 py-1">OT entered: <b>{fmt(info.ot)}</b></span>
      {info.errors.length
        ? <span className="flex items-center gap-1 rounded border border-destructive/40 bg-destructive/10 px-2 py-1 text-destructive"><AlertTriangle className="h-4 w-4" />{info.errors.length} formula problem(s): {info.errors.slice(0, 3).map((e) => `${e.address} ${e.result}`).join(", ")}</span>
        : <span className="flex items-center gap-1 rounded border border-success/40 bg-success/10 px-2 py-1 text-success"><CheckCircle2 className="h-4 w-4" />All formulas calculate</span>}
      <Button className="ml-auto gap-2" onClick={() => void download()}><Download className="h-4 w-4" />Download Excel</Button>
    </div>}
    <div className="min-h-0 w-full flex-1 overflow-auto border border-border">
      {sheet && info && <table className="border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-muted"><tr><th className="min-w-10 border border-border" />{cols.map((c) => <th key={c} className="h-7 min-w-14 border border-border font-medium">{sheet.getColumn(c).letter}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r} className={added(r) ? "bg-primary/10" : ""}>
          <th className={`sticky left-0 z-10 min-w-10 border border-border text-[10px] font-normal ${added(r) ? "bg-primary/20 text-primary" : "bg-muted"}`}>{r}</th>
          {cols.map((c) => {
            const cell = sheet.getCell(r, c);
            if (cell.isMerged && cell.master.address !== cell.address) return null;
            let colSpan = 1, rowSpan = 1;
            if (cell.isMerged) {
              while (cols.includes(c + colSpan) && sheet.getCell(r, c + colSpan).master.address === cell.address) colSpan++;
              while (rows.includes(r + rowSpan) && sheet.getCell(r + rowSpan, c).master.address === cell.address) rowSpan++;
            }
            const v = info.ev.cellValue(r, c);
            const err = info.ev.isError(v);
            return <td key={c} colSpan={colSpan} rowSpan={rowSpan} title={cell.formula ? `${cell.address}: =${cell.formula}` : cell.address}
              className={`whitespace-nowrap border border-border px-1.5 py-1 ${c === 3 ? "min-w-44" : ""} ${cell.formula ? (err ? "bg-destructive/15 font-semibold text-destructive" : "bg-accent/40 font-medium") : ""}`}>
              {fmtCell(v, cell.numFmt)}
            </td>;
          })}
        </tr>)}</tbody>
      </table>}
    </div>
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {document?.workbook.worksheets.map((p, i) => <Button key={p.id} size="sm" variant={i === index ? "default" : "outline"} onClick={() => setIndex(i)}>{p.name}</Button>)}
      <span className="ml-auto text-xs text-muted-foreground">Shaded cells are formulas (hover to see). Highlighted rows were added for extra workers.</span>
    </div>
  </>;

  if (inline) return <section aria-label="Claim sheet preview" className="mt-4 flex h-[70dvh] min-h-[28rem] min-w-0 flex-col gap-3 overflow-hidden rounded-[10px] border bg-card p-4">{content}</section>;
  return <Dialog open={!!document} onOpenChange={(o) => { if (!o) { setIndex(0); onClose(); } }}>
    <DialogContent className="flex h-[90dvh] w-[96vw] min-w-0 max-w-[96vw] flex-col gap-3 overflow-hidden p-4">{content}</DialogContent>
  </Dialog>;
}
