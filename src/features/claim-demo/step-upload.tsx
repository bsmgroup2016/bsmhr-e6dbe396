import { useState } from "react";
import { Check, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import type { ClaimDetails } from "./types";
import { DevNote } from "./shared";

const CHECKS = ["Converting PDF pages to images", "Reading name, ID and trade", "Reading 31 days of In / Out / G+OT", "Detecting crossed-out and OFF days", "Checking totals"];
const size = (b: number) => (b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);

export function StepUpload({ files, setFiles, details, setDetails, progress, failed, onRead }: {
  files: File[]; setFiles: (f: File[]) => void; details: ClaimDetails; setDetails: (d: ClaimDetails) => void;
  progress: { done: number; total: number } | null; failed: string[]; onRead: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const add = (list: FileList | null) => { if (list?.length) setFiles([...files, ...Array.from(list).filter((f) => /pdf|image/.test(f.type) || /\.pdf$/i.test(f.name))]); };

  if (progress) {
    const pct = progress.total ? (progress.done / progress.total) * 100 : 5;
    const ticks = progress.total ? Math.min(CHECKS.length, Math.floor((progress.done / progress.total) * CHECKS.length) + 1) : 1;
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-[10px] border bg-card p-6">
        <div className="flex items-center gap-2 font-medium"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Reading cards… {progress.total ? `${progress.done} / ${progress.total} pages` : ""}</div>
        <Progress value={pct} />
        <ul className="space-y-2 text-sm">
          {CHECKS.map((c, i) => (
            <li key={c} className={`flex items-center gap-2 ${i < ticks ? "" : "text-muted-foreground"}`}>
              {i < ticks - 1 ? <Check className="h-4 w-4 text-success" /> : i === ticks - 1 ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <span className="h-4 w-4 rounded-full border" />} {c}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[10px] border bg-card p-4">
          <h3 className="mb-3 font-semibold">Time card</h3>
          <label
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-[10px] border-2 border-dashed p-8 text-center text-sm ${drag ? "border-primary bg-primary/5" : ""}`}
          >
            <UploadCloud className="h-8 w-8 text-primary" />
            <span className="font-medium">Drag & drop time cards here</span>
            <span className="text-muted-foreground">PDF or image · multiple files allowed</span>
            <input type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
          </label>
          {files.map((f, i) => (
            <div key={f.name + i} className="mt-3 flex items-center gap-3 rounded-[10px] border p-3">
              <FileText className="h-8 w-8 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{f.name}</div>
                <div className="text-xs text-muted-foreground">{size(f.size)}</div>
              </div>
              <Button variant="ghost" size="icon" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
          {failed.length > 0 && (
            <div className="mt-3 rounded-[10px] border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
              {failed.map((f) => <div key={f}>{f}</div>)}
            </div>
          )}
        </div>
        <div className="space-y-3 rounded-[10px] border bg-card p-4">
          <h3 className="font-semibold">Claim details</h3>
          <div className="space-y-1">
            <Label>Client Name</Label>
            <Input value={details.client} placeholder="Optional" onChange={(e) => setDetails({ ...details, client: e.target.value })} />
            <p className="text-xs text-muted-foreground">from template sheet name</p>
          </div>
          <div className="space-y-1">
            <Label>Site Name</Label>
            <Input value={details.site} placeholder="Filled from the card" onChange={(e) => setDetails({ ...details, site: e.target.value })} />
            <p className="text-xs text-muted-foreground">from the card</p>
          </div>
          <div className="space-y-1">
            <Label>Month</Label>
            <Input type="month" value={details.month} onChange={(e) => setDetails({ ...details, month: e.target.value })} />
            <p className="text-xs text-muted-foreground">filled from the card</p>
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end"><Button disabled={!files.length} onClick={onRead}>Read cards →</Button></div>
      <DevNote>
        <p>PDFs are split one page per card, each page is stored and read by OCR (<code>readCards()</code> in pipeline.ts).</p>
        <p>Site and month are filled from the cards when they are read.</p>
      </DevNote>
    </div>
  );
}
