import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ClaimWorkbookPreview, type ClaimPreviewDocument } from "@/components/claim-workbook-preview";
import type { ClaimDetails, Worker } from "./types";
import { batchTotals } from "./helpers";
import { SummaryTiles } from "./shared";
import { buildWorkbook } from "./pipeline";

/** Shows the card data filled inside the user's own saved template, not a self-drawn sheet. */
export function StepClaim({ workers, details, onBack, onNext }: { workers: Worker[]; details: ClaimDetails; year: number; month: number; onBack: () => void; onNext: () => void }) {
  const [doc, setDoc] = useState<ClaimPreviewDocument | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true); setError("");
    try { setDoc({ workbook: await buildWorkbook(workers, details.month, details.site), fileName: `claim_sheet_${details.month}.xlsx` }); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not fill your template"); }
    finally { setBusy(false); }
  }
  useEffect(() => { void open(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <div className="rounded-[10px] border bg-card p-4 text-sm">
        <div className="font-semibold">Your claim sheet template</div>
        <p className="mt-1 text-muted-foreground">Card data is written only into your saved Excel template (Change template). Nothing else in the file is changed.</p>
        {error && <p className="mt-2 text-destructive">{error}</p>}
        <Button className="mt-3" variant="outline" disabled={busy} onClick={open}>{busy ? "Filling your template…" : "Open filled template"}</Button>
      </div>
      <div className="mt-4"><SummaryTiles t={batchTotals(workers)} /></div>
      <div className="mt-4 flex justify-between"><Button variant="outline" onClick={onBack}>← Fix cards</Button><Button onClick={onNext}>Export →</Button></div>
      <ClaimWorkbookPreview document={doc} onClose={() => setDoc(null)} />
    </div>
  );
}
