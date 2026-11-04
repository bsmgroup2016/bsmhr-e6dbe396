import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Pencil, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClaimWorkbookEditor, type ClaimEditorDocument } from "@/components/claim-workbook-editor";
import { activeClaimTemplate, loadClaimTemplate, saveClaimTemplate, type SavedClaimTemplate } from "@/lib/claim-template";
import { downloadClaimBlob } from "@/lib/combined-claim-export";
import { selectClaimTemplate } from "@/core/claim-template";

export function ClaimTemplateManager() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<SavedClaimTemplate | null>(null);
  const [error, setError] = useState("");
  const [document, setDocument] = useState<ClaimEditorDocument | null>(null);
  const [download, setDownload] = useState<Blob | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function refresh() {
    setBusy(true); setError(""); setDownload(null);
    try {
      const active = await activeClaimTemplate();
      setCurrent(active);
      setDownload(new Blob([await loadClaimTemplate()], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load template"); }
    finally { setBusy(false); }
  }

  async function replace(file: File) {
    setBusy(true);
    try {
      await saveClaimTemplate(file);
      toast.success("Blank template saved — claim sheets will use this template");
      await refresh();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not replace template"); }
    finally { setBusy(false); }
  }

  async function edit() {
    setBusy(true);
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await loadClaimTemplate());
      const base = selectClaimTemplate(workbook);
      for (const page of workbook.worksheets) if (page.id !== base.id) workbook.removeWorksheet(page.id);
      setDocument({ workbook, fileName: current?.original_name ?? "Blank claim template.xlsx" });
      setOpen(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not edit template"); }
    finally { setBusy(false); }
  }

  return <>
    <Button variant="outline" className="gap-2" onClick={() => { setOpen(true); void refresh(); }}><FileSpreadsheet className="h-4 w-4" />Blank Template</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader><DialogTitle>Claim sheet blank template</DialogTitle></DialogHeader>
        <div className="min-w-0 space-y-1">
          <p className="break-all text-sm font-medium">{busy ? "Loading…" : current?.original_name ?? "Original blank template"}</p>
          {current && <p className="text-xs text-muted-foreground">Updated {new Date(current.created_at).toLocaleString("en-SG")}</p>}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy || !!error} onClick={() => void edit()}><Pencil className="mr-2 h-4 w-4" />Edit template</Button>
          <Button variant="outline" disabled={busy || !download} onClick={() => { if (download) downloadClaimBlob(download, current?.original_name ?? "Blank claim template.xlsx"); }}><Download className="mr-2 h-4 w-4" />Download</Button>
          <Button disabled={busy} onClick={() => input.current?.click()}><Upload className="mr-2 h-4 w-4" />Replace template</Button>
        </div>
        <input ref={input} type="file" accept=".xlsx" aria-label="Replace blank claim template" className="hidden" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void replace(file); }} />
      </DialogContent>
    </Dialog>
    <ClaimWorkbookEditor title="Edit blank claim template" document={document} onClose={() => setDocument(null)} onSave={async blob => {
      await saveClaimTemplate(new File([blob], document?.fileName ?? "Blank claim template.xlsx", { type: blob.type }));
      toast.success("Blank template saved — claim sheets will use this template");
    }} />
  </>;
}