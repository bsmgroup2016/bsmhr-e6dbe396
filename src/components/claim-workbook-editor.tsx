import { useEffect, useState } from "react";
import type { CellValue, Workbook } from "exceljs";
import { Download, Loader2, Redo2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { claimWorkbookBlob, downloadClaimBlob } from "@/lib/combined-claim-export";
import { clearClaimFormulaResults, editableClaimCell, setClaimCell } from "@/core/claim-workbook-editor";

export interface ClaimEditorDocument { workbook: Workbook; fileName: string }
type Change = { sheetId: number; address: string; before: CellValue; after: CellValue };

export function ClaimWorkbookEditor({ document, onClose, onSave, title = "Edit claim sheet (Excel)" }: { document: ClaimEditorDocument | null; onClose: () => void; onSave?: (blob: Blob) => Promise<void>; title?: string }) {
  const [saving, setSaving] = useState(false);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [revision, setRevision] = useState(0);
  const [undo, setUndo] = useState<Change[][]>([]);
  const [redo, setRedo] = useState<Change[][]>([]);
  const [prepared, setPrepared] = useState<{ blob: Blob; revision: number } | null>(null);
  const [error, setError] = useState("");
  const sheet = document?.workbook.worksheets[sheetIndex];

  useEffect(() => {
    setSheetIndex(0); setUndo([]); setRedo([]); setRevision(0); setPrepared(null);
  }, [document]);

  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    setError("");
    const timer = setTimeout(() => {
      clearClaimFormulaResults(document.workbook);
      void claimWorkbookBlob(document.workbook).then(blob => {
        if (!cancelled) setPrepared({ blob, revision });
      }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Could not prepare Excel file"); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [document, revision]);

  function edit(address: string, values: string[][]) {
    if (!sheet) return;
    const origin = sheet.getCell(address);
    const changes: Change[] = [];
    values.forEach((row, r) => row.forEach((text, c) => {
      const cell = sheet.getCell(Number(origin.row) + r, Number(origin.col) + c);
      if (Number(cell.row) > sheet.rowCount || Number(cell.col) > sheet.columnCount || !editableClaimCell(sheet, cell.address)) return;
      const before = cell.value;
      if (setClaimCell(sheet, cell.address, text) && before !== cell.value) changes.push({ sheetId: sheet.id, address: cell.address, before, after: cell.value });
    }));
    if (!changes.length) return;
    setUndo(history => [...history, changes]); setRedo([]); setRevision(v => v + 1);
  }

  function travel(direction: "undo" | "redo") {
    const source = direction === "undo" ? undo : redo;
    const changes = source.at(-1);
    if (!changes || !document) return;
    changes.forEach(change => {
      const page = document.workbook.getWorksheet(change.sheetId);
      if (page) page.getCell(change.address).value = direction === "undo" ? change.before : change.after;
    });
    if (direction === "undo") { setUndo(source.slice(0, -1)); setRedo(v => [...v, changes]); }
    else { setRedo(source.slice(0, -1)); setUndo(v => [...v, changes]); }
    setRevision(v => v + 1);
  }

  const ready = prepared?.revision === revision && !error;
  const rows = sheet ? Array.from({ length: sheet.rowCount }, (_, i) => i + 1).filter(r => !sheet.getRow(r).hidden) : [];
  const columns = sheet ? Array.from({ length: sheet.columnCount }, (_, i) => i + 1).filter(c => !sheet.getColumn(c).hidden) : [];
  function close() {
    if (undo.length && !window.confirm("Close this editor? Undownloaded Excel changes will be discarded.")) return;
    onClose();
  }

  return <Dialog open={!!document} onOpenChange={open => { if (!open) close(); }}>
    <DialogContent className="flex h-[90dvh] w-[96vw] min-w-0 max-w-[96vw] flex-col gap-3 overflow-hidden p-4" aria-describedby="claim-editor-description" onInteractOutside={e => e.preventDefault()}>
      <DialogHeader className="pr-8">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription id="claim-editor-description" className="sr-only">Claim workbook editor</DialogDescription>
      </DialogHeader>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="icon" variant="outline" disabled={!undo.length} title="Undo" aria-label="Undo" onClick={() => travel("undo")}><Undo2 className="h-4 w-4" /></Button>
        <Button size="icon" variant="outline" disabled={!redo.length} title="Redo" aria-label="Redo" onClick={() => travel("redo")}><Redo2 className="h-4 w-4" /></Button>
        <span className="text-sm text-muted-foreground">{undo.length ? "Unsaved Excel changes" : "Excel draft"}</span>
        {onSave && <Button disabled={!ready || saving} onClick={async () => {
          if (!prepared) return;
          setSaving(true);
          try { await onSave(prepared.blob); onClose(); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save template"); } finally { setSaving(false); }
        }}>{saving ? "Saving…" : "Save template"}</Button>}
        <Button className="ml-auto gap-2" disabled={!ready} onClick={() => {
          if (prepared && document) { downloadClaimBlob(prepared.blob, document.fileName); toast.success("Edited claim sheet downloaded"); }
        }}>{ready ? <Download className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}Download Excel</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="min-h-0 min-w-0 w-full flex-1 overflow-auto border border-border">
        <table className="border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted"><tr><th className="min-w-10 border border-border" />{columns.map(c => <th key={c} className="h-8 min-w-20 border border-border font-medium">{sheet?.getColumn(c).letter}</th>)}</tr></thead>
          <tbody>{rows.map(r => <tr key={r}>
            <th className="sticky left-0 z-10 min-w-10 border border-border bg-muted text-xs font-normal">{r}</th>
            {columns.map(c => {
              if (!sheet) return null;
              const cell = sheet.getCell(r, c);
              if (cell.isMerged && cell.master.address !== cell.address) return null;
              // Follow template merges without mutating their ranges or formatting.
              let colSpan = 1, rowSpan = 1;
              if (cell.isMerged) {
                while (columns.includes(c + colSpan) && sheet.getCell(r, c + colSpan).master.address === cell.address) colSpan++;
                while (rows.includes(r + rowSpan) && sheet.getCell(r + rowSpan, c).master.address === cell.address) rowSpan++;
              }
              const formula = !!cell.formula;
              return <td key={c} colSpan={colSpan} rowSpan={rowSpan} className="border border-border bg-background align-middle">
                {formula ? <div className="min-w-20 px-2 py-2 text-muted-foreground" title={`=${cell.formula}`} aria-label={`${cell.address} formula`}>ƒx</div> : <Input
                  key={`${sheet.id}-${cell.address}-${revision}`}
                  aria-label={cell.address} title={cell.address} defaultValue={cell.text}
                  className={`h-9 rounded-none border-0 shadow-none ${c === 3 ? "min-w-56" : c === 2 || c === 4 ? "min-w-32" : "min-w-20"}`}
                  onBlur={event => edit(cell.address, [[event.target.value]])}
                  onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }}
                  onPaste={event => {
                    const text = event.clipboardData.getData("text/plain");
                    if (!text.includes("\t") && !text.includes("\n")) return;
                    event.preventDefault(); edit(cell.address, text.replace(/\r/g, "").replace(/\n$/, "").split("\n").map(line => line.split("\t")));
                  }} />}
              </td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>
      <div className="flex min-w-0 shrink-0 gap-2 overflow-x-auto" role="tablist" aria-label="Project sheets">{document?.workbook.worksheets.map((page, index) => <Button key={page.id} role="tab" aria-selected={index === sheetIndex} size="sm" variant={index === sheetIndex ? "default" : "outline"} onClick={() => setSheetIndex(index)}>{page.name}</Button>)}</div>
    </DialogContent>
  </Dialog>;
}