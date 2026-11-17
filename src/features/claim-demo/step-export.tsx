import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Worker } from "./types";
import { batchTotals, mismatchCount } from "./helpers";
import { DevNote, SummaryTiles } from "./shared";

export function StepExport({ workers, onBack, onRestart }: { workers: Worker[]; onBack: () => void; onRestart: () => void }) {
  const mism = workers.reduce((s, w) => s + mismatchCount(w), 0);
  const unsure = workers.reduce((s, w) => s + w.flags.length, 0);
  const crossed = workers.filter((w) => w.days.some((d) => d.status === "crossed")).length;
  const checks: [boolean, string][] = [
    [workers.length === 4 && workers.every((w) => w.days.length === 31), `${workers.length} cards read with 31 days`],
    [true, "Sundays 4, 11, 18, 25 detected and the 25th treated as OFF"],
    [true, `Crossed-out days 1–15 for ${crossed} workers are not counted as work days`],
    [mism === 0, `${mism} rows where In/Out do not match G+OT`],
    [unsure === 0, `${unsure} fields the AI was unsure about`],
  ];
  const outs = [
    ["Download Excel (.xlsx)", "Filled into your template, formulas kept"],
    ["PDF preview", "To send to the client"],
    ["Save to HR records", "Can be reopened and corrected later"],
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
          {outs.map(([t, s], i) => (
            <Button key={t} variant={i === 0 ? "default" : "outline"} className="h-auto w-full flex-col items-start py-3" onClick={() => toast(`${t}: demo only for now`)}>
              <span>{t}</span><span className={`text-xs font-normal ${i === 0 ? "opacity-80" : "text-muted-foreground"}`}>{s}</span>
            </Button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex justify-between"><Button variant="outline" onClick={onBack}>Back</Button><Button onClick={onRestart}>Start new month</Button></div>
      <DevNote><p>Plug the real writer into <code>exportExcel()</code> in helpers.ts.</p></DevNote>
    </div>
  );
}
