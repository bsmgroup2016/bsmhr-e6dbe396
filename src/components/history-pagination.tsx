import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function HistoryPagination({ offset, total, onChange }: { offset: number; total: number; onChange: (offset: number) => void }) {
  return <div className="mt-3 flex items-center justify-end gap-3">
    <span className="text-xs text-muted-foreground">{total ? offset + 1 : 0}–{Math.min(offset + 50, total)} of {total}</span>
    <Button size="icon" variant="outline" aria-label="Previous page" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - 50))}><ChevronLeft className="h-4 w-4" /></Button>
    <Button size="icon" variant="outline" aria-label="Next page" disabled={offset + 50 >= total} onClick={() => onChange(offset + 50)}><ChevronRight className="h-4 w-4" /></Button>
  </div>;
}