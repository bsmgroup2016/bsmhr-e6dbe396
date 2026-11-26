import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClaimWorkbookPreview, type ClaimPreviewDocument } from "@/components/claim-workbook-preview";
import type { ClaimDetails, Worker } from "./types";
import { batchTotals } from "./helpers";
import { SummaryTiles } from "./shared";
import { buildWorkbook } from "./pipeline";

/** Shows the exact generated workbook before export; the saved template and calculations stay unchanged. */
export function StepClaim({ workers, details, onBack, onNext }: { workers: Worker[]; details: ClaimDetails; year: number; month: number; onBack: () => void; onNext: () => void }) {
  const [document, setDocument] = useState<ClaimPreviewDocument | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setDocument(null);
    void buildWorkbook(workers, details.month, details.site, details.client)
      .then((workbook) => {
        if (active) setDocument({ workbook, fileName: `claim_sheet_${details.month}.xlsx` });
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not prepare your claim sheet preview");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [workers, details.month, details.site, details.client, attempt]);

  return (
    <div>
      <div className="rounded-[10px] border bg-card p-4 text-sm">
        <div className="font-semibold">Your claim sheet preview</div>
        <p className="mt-1 text-muted-foreground">Check the actual Excel template, worker rows, hours and totals here before downloading.</p>
      </div>
      {loading && <div role="status" className="mt-4 flex min-h-48 items-center justify-center gap-2 rounded-[10px] border bg-card text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Preparing your claim sheet preview…</div>}
      {error && !loading && <div className="mt-4 rounded-[10px] border border-destructive/40 bg-destructive/10 p-4"><p className="text-sm text-destructive">{error}</p><Button className="mt-3" variant="outline" onClick={() => setAttempt((value) => value + 1)}>Try preview again</Button></div>}
      {document && !loading && <ClaimWorkbookPreview inline document={document} onClose={() => setDocument(null)} />}
      <div className="mt-4"><SummaryTiles t={batchTotals(workers)} /></div>
      <div className="mt-4 flex justify-between"><Button variant="outline" onClick={onBack}>← Fix cards</Button><Button onClick={onNext}>Export →</Button></div>
    </div>
  );
}
