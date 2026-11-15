import { ScanLine, RotateCcw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { claimBatchProblem } from "@/core/claim-batch-validation";
import { unresolvedOcrEntries, type CardScanStatus } from "@/core/time-card-ocr-status";
import type { TimeCard } from "@/lib/types";

export function TimeCardOcrResults({ scans, cards, busy, onRetry, onReview }: { scans: CardScanStatus[]; cards: TimeCard[]; busy: boolean; onRetry: (name: string) => void; onReview: (card: TimeCard) => void }) {
  if (!scans.length && !cards.length) return null;
  return <section className="space-y-3 border-t pt-4" aria-label="Card OCR results">
    <h3 className="flex items-center gap-2 font-semibold"><ScanLine className="h-4 w-4" aria-hidden="true" />Card OCR results</h3>
    <div className="max-h-80 space-y-2 overflow-y-auto" tabIndex={0} aria-label="Scrollable card results">
      {scans.map(scan => <div key={scan.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 text-sm">
        <div className="min-w-0 flex-1"><p className="break-words font-medium">{scan.fileName}</p><p role="status" className={scan.status === "Failed" ? "text-destructive" : "text-muted-foreground"}>{scan.status} · Attempt {scan.attempts}{scan.workers !== undefined ? ` · ${scan.workers} cards · ${scan.days} dates · ${scan.uncertain} uncertain readings` : ""}</p>{scan.error && <p className="break-words text-destructive">{scan.error}</p>}</div>
        {scan.status === "Failed" && <Button variant="outline" size="sm" disabled={busy} onClick={() => onRetry(scan.id)}><RotateCcw aria-hidden="true" />Retry</Button>}
      </div>)}
      {cards.map(card => { const issue = claimBatchProblem([card], card.periodStart.slice(0, 7)); const uncertain = unresolvedOcrEntries(card.entries).length; return <div key={card.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 text-sm">
        <div className="min-w-0 flex-1"><p className="break-words font-medium">{card.entries[0]?.employeeCode} · {card.entries[0]?.workerName || card.fileName || "Time card"}</p><p className="text-muted-foreground">{card.entries.length} dates · {card.status}{!issue ? " · Date validation passed" : ""}</p>{issue && <p className="text-destructive">{issue}</p>}{uncertain > 0 && <p className="text-warning">{uncertain} uncertain reading(s) — manual check required</p>}</div>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => onReview(card)}><Eye aria-hidden="true" />{issue || uncertain ? "Review issues" : "View OCR result"}</Button>
      </div>; })}
    </div>
  </section>;
}