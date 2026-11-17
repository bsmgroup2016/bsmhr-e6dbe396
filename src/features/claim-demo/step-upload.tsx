import { useEffect, useState } from "react";
import { Check, FileText, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MOCK_FILE } from "./mock-data";
import { monthLabel } from "./helpers";
import type { ClaimDetails } from "./types";
import { DevNote } from "./shared";

const CHECKS = ["Converting PDF pages to images", "Reading name, ID and trade", "Reading 31 days of In / Out / G+OT", "Detecting crossed-out and OFF days", "Checking totals"];
const MONTHS = ["2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];

export function StepUpload({ details, setDetails, onDone }: { details: ClaimDetails; setDetails: (d: ClaimDetails) => void; onDone: () => void }) {
  const [reading, setReading] = useState(false);
  const [ticks, setTicks] = useState(0);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    if (!reading) return;
    if (ticks >= CHECKS.length) { const t = setTimeout(onDone, 300); return () => clearTimeout(t); }
    const t = setTimeout(() => setTicks((n) => n + 1), 400);
    return () => clearTimeout(t);
  }, [reading, ticks, onDone]);

  if (reading) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-[10px] border bg-card p-6">
        <div className="flex items-center gap-2 font-medium"><Loader2 className="h-4 w-4 animate-spin text-primary" /> Reading cards…</div>
        <Progress value={(ticks / CHECKS.length) * 100} />
        <ul className="space-y-2 text-sm">
          {CHECKS.map((c, i) => (
            <li key={c} className={`flex items-center gap-2 ${i < ticks ? "" : "text-muted-foreground"}`}>
              {i < ticks ? <Check className="h-4 w-4 text-success" /> : <span className="h-4 w-4 rounded-full border" />} {c}
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
            onDrop={(e) => { e.preventDefault(); setDrag(false); }}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-[10px] border-2 border-dashed p-8 text-center text-sm ${drag ? "border-primary bg-primary/5" : ""}`}
          >
            <UploadCloud className="h-8 w-8 text-primary" />
            <span className="font-medium">Drag & drop time cards here</span>
            <span className="text-muted-foreground">PDF or image · multiple files allowed</span>
            <input type="file" multiple accept="application/pdf,image/*" className="hidden" />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-[10px] border p-3">
            <FileText className="h-8 w-8 text-destructive" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{MOCK_FILE.name}</div>
              <div className="text-xs text-muted-foreground">{MOCK_FILE.size} · {MOCK_FILE.pages} pages</div>
            </div>
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">✓ 4 Work Record Cards found</span>
          </div>
        </div>
        <div className="space-y-3 rounded-[10px] border bg-card p-4">
          <h3 className="font-semibold">Claim details</h3>
          <div className="space-y-1">
            <Label>Client Name</Label>
            <Input value={details.client} onChange={(e) => setDetails({ ...details, client: e.target.value })} />
            <p className="text-xs text-muted-foreground">from template sheet name</p>
          </div>
          <div className="space-y-1">
            <Label>Site Name</Label>
            <Input value={details.site} onChange={(e) => setDetails({ ...details, site: e.target.value })} />
            <p className="text-xs text-muted-foreground">from the card</p>
          </div>
          <div className="space-y-1">
            <Label>Month</Label>
            <Select value={details.month} onValueChange={(month) => setDetails({ ...details, month })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS.map((m) => <SelectItem key={m} value={m}>{monthLabel(m)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end"><Button onClick={() => { setTicks(0); setReading(true); }}>Read cards →</Button></div>
      <DevNote>
        <p>Files are split into one image per page. Each page is one worker's monthly Work Record Card.</p>
        <p>Plug real OCR into <code>readCards()</code> in helpers.ts; it must return <code>Worker[]</code>.</p>
      </DevNote>
    </div>
  );
}
