import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AiBrainAuto } from "@/components/ai-brain-assist";
import { fetchR2Blob } from "@/lib/r2";
import { IPA_DETAIL_FIELDS } from "@/core/ipa-detail-fields";
import type { IpaExtract } from "@/core/ipa-registration";

const labelFor = (key: string) => IPA_DETAIL_FIELDS.find(field => field.key === key)?.label ?? key.replace(/([A-Z])/g, " $1").replace(/^./, c => c.toUpperCase());

export function IpaReview({ url, extracted, reviewed, onReviewed }: { url: string; extracted: IpaExtract; reviewed: boolean; onReviewed: (value: boolean) => void }) {
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";
    let dispose: (() => void) | undefined;
    setLoading(true); setImage(""); setError("");
    async function render() {
      try {
        const blob = await fetchR2Blob(url);
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const pdfFile = String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
        if (pdfFile) {
          const pdfjs = await import("pdfjs-dist");
          pdfjs.GlobalWorkerOptions.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
          const task = pdfjs.getDocument({ data: bytes });
          dispose = () => { void task.destroy(); };
          if (cancelled) { dispose(); return; }
          const pdf = await task.promise;
          if (cancelled) return;
          setPages(pdf.numPages);
          const sheet = await pdf.getPage(Math.min(page, pdf.numPages));
          const viewport = sheet.getViewport({ scale: 1.6 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width; canvas.height = viewport.height;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Document display is unavailable.");
          await sheet.render({ canvasContext: context, canvas, viewport }).promise;
          if (!cancelled) setImage(canvas.toDataURL("image/png"));
        } else {
          objectUrl = URL.createObjectURL(new Blob([bytes], { type: blob.type.startsWith("image/") ? blob.type : "image/jpeg" }));
          if (!cancelled) { setPages(1); setImage(objectUrl); }
        }
      } catch { if (!cancelled) setError("Could not display the original IPA. Retry to verify the document."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void render();
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); dispose?.(); };
  }, [url, page, retry]);
  const details = Object.entries(extracted).filter(([key, value]) => key !== "additionalDetails" && value !== undefined && value !== null && value !== "");
  const missing = [["name", "Name"], ["fin", "FIN"], ["passportNumber", "Passport number"]].filter(([key]) => !extracted[key as keyof IpaExtract]);
  return <aside className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:self-start" aria-label="IPA verification">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">Original IPA</h3>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" aria-label="Previous IPA page" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
        <span className="text-xs">{page} / {pages}</span>
        <Button type="button" variant="outline" size="icon" aria-label="Next IPA page" disabled={page >= pages || loading} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
      </div>
    </div>
    <div className="h-[440px] overflow-auto rounded-lg border bg-muted/30 lg:h-[520px]">
      {loading && <p role="status" className="flex items-center gap-2 p-4 text-sm"><Loader2 className="h-4 w-4 animate-spin" />Loading document…</p>}
      {error && <div role="alert" className="space-y-3 p-4 text-sm text-destructive"><p>{error}</p><Button type="button" variant="outline" onClick={() => setRetry(v => v + 1)}><RotateCcw className="mr-2 h-4 w-4" />Retry</Button></div>}
      {image && <a href={image} target="_blank" rel="noreferrer" aria-label="Open full-size IPA page"><img src={image} alt={`Original IPA page ${page}`} className="h-auto w-full" /></a>}
    </div>
    <details className="rounded-lg border p-3" open>
      <summary className="cursor-pointer text-sm font-semibold">IPA readings · {reviewed ? "Reviewed" : "Unverified"}</summary>
      <dl className="mt-3 max-h-60 space-y-2 overflow-y-auto text-xs">
        {missing.map(([key, label]) => <div key={key} className="text-destructive"><dt className="font-medium">{label}</dt><dd>Not read — enter and verify manually</dd></div>)}
        {details.map(([key, value]) => <div key={key} className="grid grid-cols-2 gap-2 border-b pb-2"><dt className="text-muted-foreground">{labelFor(key)}</dt><dd className="break-words">{String(value)}</dd></div>)}
        {extracted.additionalDetails?.map((detail, index) => <div key={index} className="border-b pb-2"><dt className="text-muted-foreground">{detail.label}{detail.page ? ` · Page ${detail.page}` : ""}</dt><dd className="break-words">{detail.value}</dd></div>)}
      </dl>
    </details>
    <AiBrainAuto title="AI Brain check" task="Check these IPA readings for a Singapore work permit applicant. List any missing, inconsistent or suspicious values (FIN format, passport number, dates, age, salary, employer). Give a short verdict and a checklist of what HR must verify manually." data={{ ...extracted, missing: missing.map(([, l]) => l) }} />
    <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-primary" checked={reviewed} disabled={!image || loading || !!error} onChange={e => onReviewed(e.target.checked)} />I have checked the form details against the original IPA.</label>
  </aside>;
}