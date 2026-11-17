import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Worker } from "./types";
import { batchTotals, isSunday, mismatchCount } from "./helpers";
import { DevNote, SummaryTiles } from "./shared";
import { downloadExcel, saveToRecords } from "./pipeline";

export function StepExport({ workers, month, site, onBack, onRestart }: { workers: Worker[]; month: string; site: string; onBack: () => void; onRestart: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [y, m] = month.split("-").map(Number);
  const days = workers[0]?.days.length ?? 0;
  const mism = workers.reduce((s, w) => s + mismatchCount(w), 0);
  const unsure = workers.reduce((s, w) => s + w.flags.length, 0);
  const sundays = Array.from({ length: days }, (_, i) => i + 1).filter((d) => isSunday(y, m, d));
  const offs = [...new Set(workers.flatMap((w) => w.days.filter((d) => d.status === "off").map((d) => d.day)))];
  const checks: [boolean, string][] = [
    [workers.length > 0, `${workers.length} cards read with ${days} days`],
    [true, `Sundays ${sundays.join(", ")} detected${offs.length ? `; OFF days: ${offs.join(", ")}` : ""}`],
    [true, "Days not worked or crossed out are not counted as work days"],
    [mism === 0, `${mism} rows where In/Out do not match G+OT`],
    [unsure === 0, `${unsure} fields the AI was unsure about`],
  ];
  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); } catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(null); }
  };
  const outs: [string, string, () => void][] = [
    ["Download Excel (.xlsx)", "Filled into your template, formulas kept", () => run("x", () => downloadExcel(workers, month, site), "Claim sheet downloaded")],
    ["PDF preview", "To send to the client", () => toast("PDF preview is not available yet")],
    ["Save to HR records", "Can be reopened and corrected later", () => run("s", () => saveToRecords(workers, month, site), "Saved to HR records")],
  ];
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4 rounded-[10px] border bg-card p-4">
          <h3 className="font-semibold">Checks before export</h3>
          <ul className="space-y-2 text-sm">
            {checks.map(([ok, t]) => (
              <li key={t} className="flex gap-2">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${ok ? "bg-success/15 text-success" : "bg-warning/20 text-warning"}`}>{ok ? "✓" : "!"}</span>{t}
              </li>
            ))}
          </ul>
          <SummaryTiles t={batchTotals(workers)} />
        </div>
        <div className="space-y-3 rounded-[10px] border bg-card p-4">
          <h3 className="font-semibold">Output</h3>
          {outs.map(([t, s, fn], i) => (
            <Button key={t} disabled={busy !== null} variant={i === 0 ? "default" : "outline"} className="h-auto w-full flex-col items-start py-3" onClick={fn}>
              <span className="flex items-center gap-2">{busy === (i === 0 ? "x" : i === 2 ? "s" : "") && <Loader2 className="h-4 w-4 animate-spin" />}{t}</span>
              <span className={`text-xs font-normal ${i === 0 ? "opacity-80" : "text-muted-foreground"}`}>{s}</span>
            </Button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex justify-between"><Button variant="outline" onClick={onBack}>Back</Button><Button onClick={onRestart}>Start new month</Button></div>
      <DevNote><p>Download uses <code>downloadExcel()</code> and the current blank template; Save uses <code>saveToRecords()</code> in pipeline.ts.</p></DevNote>
    </div>
  );
}
