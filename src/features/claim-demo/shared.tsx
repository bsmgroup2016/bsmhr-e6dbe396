import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function DevNote({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  if (import.meta.env.PROD) return null;
  return (
    <div className="mt-4 rounded-[10px] border border-dashed bg-muted/40 text-sm">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-3 py-2 text-muted-foreground">
        What happens in this step (for developers)
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-1 px-3 pb-3 text-muted-foreground">{children}</div>}
    </div>
  );
}

export function SummaryTiles({ t }: { t: { staff: number; g: number; ot: number; total: number } }) {
  const tiles = [["Staff", t.staff], ["Total G-Hrs", t.g], ["Total OT Hrs", t.ot], ["Grand Hrs", t.total]] as const;
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map(([l, v], i) => (
        <div key={l} className={`rounded-[10px] border p-3 ${i === 3 ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>
          <div className={`text-xs ${i === 3 ? "opacity-85" : "text-muted-foreground"}`}>{l}</div>
          <div className="font-mono text-2xl font-semibold">{v}</div>
        </div>
      ))}
    </div>
  );
}
