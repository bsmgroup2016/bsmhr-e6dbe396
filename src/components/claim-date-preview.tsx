import { FileSpreadsheet, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { claimDatePreview } from "@/core/claim-date-preview";
import { isCardApproved } from "@/core/time-card-settlement";
import type { ClaimSheetRow, TimeCard } from "@/lib/types";

export function ClaimDatePreview({ open, onOpenChange, prepared, workerName, workerCode, ready, generating, onReview, onGenerate }: {
  open: boolean; onOpenChange: (open: boolean) => void;
  prepared: { card: TimeCard; snapshot: ClaimSheetRow[] }[];
  workerName: (card: TimeCard) => string; workerCode: (card: TimeCard) => string;
  ready: boolean; generating: boolean; onReview: (card: TimeCard) => void; onGenerate: () => void;
}) {
  const ordered = [...prepared].sort((a, b) => workerCode(a.card).localeCompare(workerCode(b.card), undefined, { numeric: true }));
  return <Dialog open={open} onOpenChange={value => { if (!generating) onOpenChange(value); }}>
    <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] flex-col sm:max-w-5xl">
      <DialogHeader>
        <DialogTitle>Claim sheet preview — dates & hours</DialogTitle>
        <DialogDescription>{prepared.length} workers · {prepared.reduce((sum, item) => sum + item.snapshot.length, 0)} worked date entries</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto">
        {ordered.map(({ card, snapshot }, index) => {
          const rows = claimDatePreview(card, snapshot);
          return <section key={card.id} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="break-words font-semibold">{index + 1}. {workerCode(card)} · {workerName(card)}</h3>
                <p className="text-sm text-muted-foreground">{isCardApproved(card) ? "Approved" : "Awaiting approval"} · {snapshot.length} worked dates · GW hrs: {snapshot.reduce((sum, row) => sum + row.normalHours, 0)} · OT hrs: {snapshot.reduce((sum, row) => sum + row.otHours, 0)}</p>
              </div>
              <Button variant="outline" size="sm" disabled={generating} onClick={() => onReview(card)}><Pencil className="mr-2 h-4 w-4" />Review card</Button>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Day</TableHead><TableHead className="text-right">GW hrs</TableHead><TableHead className="text-right">OT hrs</TableHead><TableHead>Site</TableHead><TableHead>Claim status</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
              <TableBody>{rows.map((row, rowIndex) => <TableRow key={`${row.date}-${rowIndex}`}>
                <TableCell className="whitespace-nowrap font-medium">{row.date}</TableCell>
                <TableCell>{new Date(`${row.date}T00:00:00Z`).toLocaleDateString("en-SG", { weekday: "short", timeZone: "UTC" })}</TableCell>
                <TableCell className="text-right tabular-nums">{row.normalHours || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{row.otHours || "—"}</TableCell>
                <TableCell className="whitespace-nowrap">{row.site || "—"}</TableCell>
                <TableCell className={row.disposition === "Included" ? "text-success" : "text-muted-foreground"}>{row.disposition}</TableCell>
                <TableCell className="min-w-32 break-words">{row.remarks || "—"}</TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </section>;
        })}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
        <Button variant="outline" disabled={generating} onClick={() => onOpenChange(false)}>Back</Button>
        <Button disabled={!ready || generating} onClick={onGenerate}><FileSpreadsheet className="mr-2 h-4 w-4" />{generating ? "Generating…" : "Generate claim sheet"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}