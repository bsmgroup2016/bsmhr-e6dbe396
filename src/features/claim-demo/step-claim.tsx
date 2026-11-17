import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ClaimDetails, Worker } from "./types";
import { batchTotals } from "./helpers";
import { SummaryTiles } from "./shared";
import { downloadExcel } from "./pipeline";

/** Fills the user's own saved template and downloads it directly (no in-app preview). */
export function StepClaim({ workers, details, onBack, onNext }: { workers: Worker[]; details: ClaimDetails; year: number; month: number; onBack: () => void; onNext: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true); setError("");
    try { await downloadExcel(workers, details.month, details.site); toast.success("Claim sheet downloaded"); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not fill your template"); }
    finally { setBusy(false); }
  }
  return (
    <div>
      <div className="rounded-[10px] border bg-card p-4 text-sm">
        <div className="font-semibold">Your claim sheet</div>
        <p className="mt-1 text-muted-foreground">Card data is written into your saved Excel template. Open the file in Excel to see all totals.</p>
        {error && <p className="mt-2 text-destructive">{error}</p>}
        <Button className="mt-3 gap-2" disabled={busy} onClick={() => void download()}><Download className="h-4 w-4" />{busy ? "Preparing…" : "Download claim sheet (Excel)"}</Button>
      </div>
      <div className="mt-4"><SummaryTiles t={batchTotals(workers)} /></div>
      <div className="mt-4 flex justify-between"><Button variant="outline" onClick={onBack}>← Fix cards</Button><Button onClick={onNext}>Export →</Button></div>
    </div>
  );
}
