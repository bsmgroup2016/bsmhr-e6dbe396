import { ScanLine, RotateCcw, Eye } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { claimBatchProblem } from "@/core/claim-batch-validation";
import { unresolvedOcrEntries, matchesOcrFilter, cardOcrFlags, scanOcrFlags, type OcrResultFilter, type CardScanStatus } from "@/core/time-card-ocr-status";
import type { TimeCard } from "@/lib/types";

export function TimeCardOcrResults({ scans, cards, busy, onRetry, onReview, filter, onFilterChange, month }: { scans: CardScanStatus[]; cards: TimeCard[]; busy: boolean; onRetry: (name: string) => void; onReview: (card: TimeCard) => void; filter: OcrResultFilter; onFilterChange: (filter: OcrResultFilter) => void; month: string }) {
  if (!scans.length && !cards.length) return null;
  const filteredCards = cards.filter(card => matchesOcrFilter(filter, cardOcrFlags(card, scans, month)));
  const filteredScans = scans.filter(scan => matchesOcrFilter(filter, { ...scanOcrFlags(scan), uncertain: !cards.some(card => card.fileName === scan.fileName || scan.id === `rescan:${card.id}`) && (scan.uncertain ?? 0) > 0 }));
  return <section className="space-y-3 border-t pt-4" aria-label="Card OCR results">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 font-semibold"><ScanLine className="h-4 w-4" aria-hidden="true" />Card OCR results</h3>
      <Select value={filter} onValueChange={value => onFilterChange(value as OcrResultFilter)}><SelectTrigger aria-label="Filter OCR cards" className="w-52"><SelectValue /></SelectTrigger><SelectContent>
        <SelectItem value="All">All results</SelectItem><SelectItem value="Issues">Needs attention</SelectItem><SelectItem value="Errors">OCR / validation errors</SelectItem><SelectItem value="Retry">Retried cards</SelectItem><SelectItem value="Uncertain">Uncertain information</SelectItem>
      </SelectContent></Select>
    </div>
    <p role="status" className="text-sm text-muted-foreground">{filteredCards.length} cards · {filteredScans.length} file readings</p>
    <div className="max-h-80 space-y-2 overflow-y-auto" tabIndex={0} aria-label="Scrollable card results">
      {!filteredCards.length && !filteredScans.length && <p className="py-3 text-sm text-muted-foreground">No results match this filter.</p>}
      {filteredScans.map(scan => <div key={scan.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 text-sm">
        <div className="min-w-0 flex-1"><p className="break-words font-medium">{scan.fileName}</p><p role="status" className={scan.status === "Failed" ? "text-destructive" : "text-muted-foreground"}>{scan.status} · Attempt {scan.attempts}{scan.workers !== undefined ? ` · ${scan.workers} cards · ${scan.days} dates · ${scan.uncertain} uncertain readings` : ""}</p>{scan.error && <p className="break-words text-destructive">{scan.error}</p>}</div>
        {scan.status === "Failed" && <Button variant="outline" size="sm" disabled={busy} onClick={() => onRetry(scan.id)}><RotateCcw aria-hidden="true" />Retry</Button>}
      </div>)}
      {filteredCards.map(card => { const issue = claimBatchProblem([card], month); const uncertain = unresolvedOcrEntries(card.entries).length; return <div key={card.id} className="flex flex-wrap items-center justify-between gap-3 border-b py-3 text-sm">
        <div className="min-w-0 flex-1"><p className="break-words font-medium">{card.entries[0]?.employeeCode} · {card.entries[0]?.workerName || card.fileName || "Time card"}</p><p className="text-muted-foreground">{card.entries.length} dates · {card.status}{!issue ? " · Date validation passed" : ""}</p>{issue && <p className="text-destructive">{issue}</p>}{uncertain > 0 && <p className="text-warning">{uncertain} uncertain reading(s) — manual check required</p>}</div>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => onReview(card)}><Eye aria-hidden="true" />{issue || uncertain ? "Review issues" : "View OCR result"}</Button>
      </div>; })}
    </div>
  </section>;
}