import { Button } from "@/components/ui/button";
import type { ClaimDetails, Worker } from "./types";
import { batchTotals, isSunday, monthShort, weekday, workerTotals } from "./helpers";
import { DevNote, SummaryTiles } from "./shared";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const c = "border px-1 py-1 text-center";

export function StepClaim({ workers, details, year, month, onBack, onNext }: { workers: Worker[]; details: ClaimDetails; year: number; month: number; onBack: () => void; onNext: () => void }) {
  const sunCls = (d: number) => (isSunday(year, month, d) ? "bg-[var(--claim-sun)]" : "");
  return (
    <div>
      <div className="mb-3 flex flex-wrap justify-between gap-2">
        <div><div className="font-semibold">{details.client || "—"}</div><div className="text-sm text-muted-foreground">{details.site}</div></div>
        <div className="text-right"><div className="font-semibold">CLAIM SUMMARY FOR {monthShort(details.month)}</div><div className="text-sm text-muted-foreground">{workers.length} staff</div></div>
      </div>
      <div className="overflow-x-auto rounded-[10px] border">
        <table className="min-w-[1500px] border-collapse text-xs">
          <thead className="bg-muted">
            <tr>
              {["S/n", "Co.", "Staff Code", "Staff Name", "Category", ""].map((h, i) => <th key={i} rowSpan={2} className={c}>{h}</th>)}
              {DAYS.map((d) => <th key={d} className={`${c} font-mono ${isSunday(year, month, d) ? "bg-[var(--claim-sun-strong)]" : ""}`}>{d}</th>)}
              {["Total Hrs", "Grand Hrs", "No. of Days"].map((h) => <th key={h} rowSpan={2} className={c}>{h}</th>)}
            </tr>
            <tr>{DAYS.map((d) => <th key={d} className={`${c} font-normal ${isSunday(year, month, d) ? "bg-[var(--claim-sun-strong)]" : ""}`}>{weekday(year, month, d)}</th>)}</tr>
          </thead>
          <tbody className="bg-card">
            {workers.map((w, i) => {
              const t = workerTotals(w);
              return (["g", "ot"] as const).map((k) => (
                <tr key={w.id + k}>
                  {k === "g" && (
                    <>
                      <td rowSpan={2} className={c}>{i + 1}</td>
                      <td rowSpan={2} className={c}></td>
                      <td rowSpan={2} className={`${c} font-mono`}>{w.code}</td>
                      <td rowSpan={2} className={`${c} whitespace-nowrap text-left`}>{w.name}</td>
                      <td rowSpan={2} className={c}>{w.category}</td>
                    </>
                  )}
                  <td className={`${c} whitespace-nowrap`}>{k === "g" ? "G-Hrs" : "OT Hrs"}</td>
                  {w.days.map((d) => (
                    <td key={d.day} className={`${c} font-mono ${d.status === "crossed" ? "bg-muted" : sunCls(d.day)}`}>
                      {d.status === "off" ? (k === "g" ? "OFF" : "") : d.status === "work" ? (d[k] || "") : ""}
                    </td>
                  ))}
                  <td className={`${c} font-mono font-medium`}>{k === "g" ? t.g : t.ot}</td>
                  {k === "g" && <><td rowSpan={2} className={`${c} font-mono font-semibold`}>{t.total}</td><td rowSpan={2} className={`${c} font-mono`}>{t.days}</td></>}
                </tr>
              ));
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4"><SummaryTiles t={batchTotals(workers)} /></div>
      <div className="mt-4 flex justify-between"><Button variant="outline" onClick={onBack}>← Fix cards</Button><Button onClick={onNext}>Export →</Button></div>
      <DevNote><p>This preview mirrors the Excel template: two rows per worker, merged identity cells, only hours from the cards.</p></DevNote>
    </div>
  );
}
