import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, FileSpreadsheet, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSignedUrl } from "@/lib/r2";
import type { TimeCard, TimeCardEntry } from "@/lib/types";

export interface ReviewIssue {
  key: string;
  card: TimeCard;
  date?: string;
  reason: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  issues: ReviewIssue[];
  blocker?: string | null;
  workerName: (card: TimeCard) => string;
  generating: boolean;
  onEdit: (card: TimeCard, date: string, patch: Partial<TimeCardEntry>) => void;
  onApproveRow: (card: TimeCard, date: string) => void;
  onGenerate: () => void;
}

function CardPreview({ src, name }: { src?: string; name?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    let active = true;
    setUrl(null); setFailed(false); setZoom(1);
    if (!src) return;
    getSignedUrl(src).then(u => active && setUrl(u)).catch(() => active && setFailed(true));
    return () => { active = false; };
  }, [src]);
  const isPdf = /\.pdf($|\?)/i.test(name ?? "") || /\.pdf($|\?|%)/i.test(src ?? "");
  if (!src || failed) return <div className="grid h-full min-h-64 place-items-center rounded-lg border bg-muted text-sm text-muted-foreground">Time card image not available</div>;
  if (!url) return <div className="h-full min-h-64 animate-pulse rounded-lg bg-muted" />;
  if (isPdf) return <iframe title="Time card" src={url} className="h-[60dvh] w-full rounded-lg border bg-muted" />;
  return (
    <div className="relative h-[60dvh] overflow-auto rounded-lg border bg-muted">
      <div className="sticky top-2 z-10 ml-auto mr-2 flex w-fit gap-1">
        <Button size="icon" variant="secondary" aria-label="Zoom out" onClick={() => setZoom(z => Math.max(1, z - 0.5))}><ZoomOut className="h-4 w-4" /></Button>
        <Button size="icon" variant="secondary" aria-label="Zoom in" onClick={() => setZoom(z => Math.min(4, z + 0.5))}><ZoomIn className="h-4 w-4" /></Button>
      </div>
      <img src={url} alt="Original time card" style={{ width: `${zoom * 100}%` }} className="max-w-none" />
    </div>
  );
}

const fmt = (value?: number) => (value === undefined ? "" : String(value));

export function IssueReviewDialog({ open, onOpenChange, issues, blocker, workerName, generating, onEdit, onApproveRow, onGenerate }: Props) {
  const [index, setIndex] = useState(0);
  const safeIndex = Math.min(index, Math.max(0, issues.length - 1));
  const issue = issues[safeIndex];
  const entry = issue?.date ? issue.card.entries.find(row => row.date === issue.date) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94dvh] w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>{issues.length ? `Please check ${issues.length} item(s)` : "All checked"}</DialogTitle>
          <DialogDescription>
            {issues.length ? "Fix the reading on the left by looking at the time card on the right, or approve the AI reading." : "Every card is ready. Generate the claim sheet now."}
          </DialogDescription>
        </DialogHeader>

        {blocker && <div role="alert" className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm"><AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />{blocker}</div>}

        {issue ? (
          <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <Button size="sm" variant="outline" disabled={safeIndex === 0} onClick={() => setIndex(safeIndex - 1)}><ChevronLeft className="h-4 w-4" />Prev</Button>
                <span className="text-sm text-muted-foreground">{safeIndex + 1} / {issues.length}</span>
                <Button size="sm" variant="outline" disabled={safeIndex >= issues.length - 1} onClick={() => setIndex(safeIndex + 1)}>Next<ChevronRight className="h-4 w-4" /></Button>
              </div>
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="font-semibold text-foreground">{workerName(issue.card)}</p>
                <p className="text-sm text-muted-foreground">{issue.date ? `Date: ${issue.date}` : "Whole card"}</p>
                <p className="mt-2 flex gap-2 text-sm text-warning"><AlertTriangle className="h-4 w-4 shrink-0" />{issue.reason}</p>
              </div>
              {entry && issue.date ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1"><Label htmlFor="fix-in">Time in</Label><Input id="fix-in" value={entry.checkIn ?? ""} placeholder="07:00" onChange={e => onEdit(issue.card, issue.date!, { checkIn: e.target.value || undefined })} /></div>
                    <div className="space-y-1"><Label htmlFor="fix-out">Time out</Label><Input id="fix-out" value={entry.checkOut ?? ""} placeholder="17:00" onChange={e => onEdit(issue.card, issue.date!, { checkOut: e.target.value || undefined })} /></div>
                    <div className="space-y-1"><Label htmlFor="fix-gw">GW hrs</Label><Input id="fix-gw" type="number" min={0} step="0.5" value={fmt(entry.normalHours)} onChange={e => onEdit(issue.card, issue.date!, { normalHours: e.target.value === "" ? undefined : Number(e.target.value) })} /></div>
                    <div className="space-y-1"><Label htmlFor="fix-ot">OT hrs</Label><Input id="fix-ot" type="number" min={0} step="0.5" value={fmt(entry.otHours)} onChange={e => onEdit(issue.card, issue.date!, { otHours: e.target.value === "" ? undefined : Number(e.target.value) })} /></div>
                  </div>
                  {entry.suggestion && (entry.suggestion.checkIn || entry.suggestion.checkOut) && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2 text-sm">
                      <span>Other reading: {entry.suggestion.checkIn ?? "—"} → {entry.suggestion.checkOut ?? "—"}</span>
                      <Button size="sm" variant="outline" onClick={() => onEdit(issue.card, issue.date!, { checkIn: entry.suggestion?.checkIn ?? entry.checkIn, checkOut: entry.suggestion?.checkOut ?? entry.checkOut })}>Use this</Button>
                    </div>
                  )}
                  <Button className="w-full gap-2" onClick={() => onApproveRow(issue.card, issue.date!)}><CheckCircle2 className="h-4 w-4" />Approve this reading</Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Remove the duplicate card or upload the correct card, then try again.</p>
              )}
            </div>
            <CardPreview src={issue.card.fileUrl} name={issue.card.fileName} />
          </div>
        ) : (
          <div className="grid place-items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-success" />
            <p className="text-sm text-muted-foreground">No problems left.</p>
          </div>
        )}

        <div className="flex justify-end border-t pt-3">
          <Button disabled={issues.length > 0 || !!blocker || generating} onClick={onGenerate} className="gap-2"><FileSpreadsheet className="h-4 w-4" />{generating ? "Generating…" : "Approve all & generate claim sheet"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
