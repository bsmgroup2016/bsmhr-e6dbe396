import { useEffect, useState } from "react";
import { Download, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export type MediaPreviewFile = { name: string; url: string; contentType: string };

export function MediaPreview({ file, onClose }: { file: MediaPreviewFile | null; onClose: () => void }) {
  const [sheets, setSheets] = useState<{ name: string; rows: string[][] }[]>([]);
  const [sheet, setSheet] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const excel = !!file && /\.(xlsx?|csv)$/i.test(file.name);
  useEffect(() => {
    setSheets([]); setSheet(0); setError("");
    if (!file || !excel) return;
    const controller = new AbortController();
    setBusy(true);
    (async () => {
      try {
        const response = await fetch(file.url, { signal: controller.signal });
        if (!response.ok) throw new Error("Could not read workbook");
        const XLSX = await import("xlsx");
        const book = XLSX.read(await response.arrayBuffer(), { type: "array", sheetRows: 200 });
        if (!controller.signal.aborted) setSheets(book.SheetNames.map(name => ({ name, rows: XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], { header: 1, defval: "", raw: false }).map(row => row.slice(0, 50).map(value => String(value ?? ""))) })));
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Preview unavailable; download the file instead."); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    })();
    return () => controller.abort();
  }, [file, excel]);

  async function download() {
    if (!file) return;
    try {
      const res = await fetch(file.url);
      if (!res.ok) throw new Error("Download failed");
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a"); link.href = url; link.download = file.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { setError("Could not download file. Close and reopen it to retry."); }
  }

  return <Dialog open={!!file} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-5xl">
      <DialogHeader><DialogTitle>{file?.name}</DialogTitle><DialogDescription>File preview</DialogDescription></DialogHeader>
      {file && <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          {excel && sheets.length > 0 ? <select className="max-w-full rounded-md border bg-background p-2 text-sm" aria-label="Worksheet" value={sheet} onChange={event => setSheet(Number(event.target.value))}>{sheets.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}</select> : <span />}
          <Button variant="outline" size="sm" onClick={download}><Download className="h-4 w-4" />Download</Button>
        </div>
        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
        {busy ? <div className="flex items-center justify-center gap-2 py-16"><Loader2 className="h-5 w-5 animate-spin" />Loading preview…</div>
          : excel ? <div className="max-h-[60dvh] overflow-auto rounded-md border"><table className="w-full text-xs"><tbody>{sheets[sheet]?.rows.map((row, i) => <tr key={i} className="border-b"><th className="sticky left-0 bg-muted px-3 py-2 text-muted-foreground">{i + 1}</th>{row.map((cell, j) => <td key={j} className="min-w-24 max-w-80 break-words border-l px-3 py-2">{cell}</td>)}</tr>)}</tbody></table></div>
          : /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(file.name) ? <img src={file.url} alt={file.name} className="max-h-[65dvh] w-full object-contain" />
          : /\.pdf$/i.test(file.name) ? <iframe src={file.url} title={file.name} className="h-[65dvh] w-full rounded-md border" />
          : /\.(mp4|webm|mov)$/i.test(file.name) ? <video src={file.url} controls className="max-h-[65dvh] w-full" />
          : /\.(mp3|wav|ogg|m4a)$/i.test(file.name) ? <audio src={file.url} controls className="w-full" />
          : <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground"><FileText className="h-10 w-10" /><p>Preview unavailable for this file type.</p></div>}
        {excel && <p className="text-xs text-muted-foreground">Preview: first 200 rows and 50 columns per worksheet. Download includes the complete original file.</p>}
      </>}
    </DialogContent>
  </Dialog>;
}