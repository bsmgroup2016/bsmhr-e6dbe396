import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Worker, FieldFlag } from "./types";
import { isSunday, problemCount, rowMatches, surname, weekday, workerTotals } from "./helpers";
import { DevNote } from "./shared";

const FIELDS: { key: FieldFlag["field"]; label: string; prop: keyof Worker }[] = [
  { key: "name", label: "Staff Name", prop: "name" },
  { key: "code", label: "Staff Code (ID Card No)", prop: "code" },
  { key: "category", label: "Category (Occupation)", prop: "category" },
  { key: "address", label: "Address", prop: "address" },
];

function cardSvg(name: string) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='800'><rect width='100%' height='100%' fill='#f4f1e8'/><text x='30' y='50' font-family='monospace' font-size='22' fill='#333'>WORK RECORD CARD</text><text x='30' y='85' font-family='monospace' font-size='16' fill='#555'>${name}</text>${Array.from({ length: 16 }, (_, i) => `<line x1='30' x2='290' y1='${130 + i * 40}' y2='${130 + i * 40}' stroke='#bbb'/><line x1='310' x2='570' y1='${130 + i * 40}' y2='${130 + i * 40}' stroke='#bbb'/>`).join("")}<line x1='300' x2='300' y1='110' y2='780' stroke='#999'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function StepReview({ workers, year, month, onEdit, onBack, onNext }: {
  workers: Worker[]; year: number; month: number;
  onEdit: (wid: string, day: number, key: "g" | "ot", v: number | null) => void;
  onBack: () => void; onNext: () => void;
}) {
  return (
    <div>
      <Tabs defaultValue={workers[0]?.id}>
        <TabsList className="h-auto flex-wrap">
          {workers.map((w) => {
            const p = problemCount(w);
            return (
              <TabsTrigger key={w.id} value={w.id} className="gap-2">
                {surname(w.name)}
                <span className={`rounded-full px-1.5 text-xs ${p ? "bg-warning/20 text-warning" : "bg-success/15 text-success"}`}>{p ? `⚠ ${p}` : "✓"}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        {workers.map((w) => {
          const t = workerTotals(w);
          return (
            <TabsContent key={w.id} value={w.id}>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <figure className="rounded-[10px] border bg-card p-2">
                  <img src={cardSvg(w.name)} alt={`Scanned card for ${w.name}`} className="w-full rounded" />
                  <figcaption className="mt-2 text-xs text-muted-foreground">Scanned card (days 1–15 on the left, 16–31 on the right)</figcaption>
                </figure>
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap gap-2 text-xs">
                    {["Qty → In", "Site No. → Out", "Amount '8+3' → G-Hrs + OT"].map((p) => (
                      <span key={p} className="rounded-full bg-[var(--claim-pill)] px-2 py-0.5 text-[var(--claim-pill-ink)]">{p}</span>
                    ))}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {FIELDS.map((f) => {
                      const flag = w.flags.find((x) => x.field === f.key);
                      return (
                        <div key={f.key} className="space-y-1">
                          <div className="text-xs text-muted-foreground">{f.label}{flag && <span className="ml-1 text-warning">check: {flag.reason}</span>}</div>
                          <Input readOnly value={String(w[f.prop])} className={flag ? "border-warning ring-1 ring-warning" : ""} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="max-h-[380px] overflow-auto rounded-[10px] border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-muted">
                        <tr>{["Date", "Day", "In", "Out", "G-Hrs", "OT", "Check"].map((h) => <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>)}</tr>
                      </thead>
                      <tbody className="font-mono">
                        {w.days.map((d) => {
                          const sun = isSunday(year, month, d.day);
                          const ok = rowMatches(d);
                          const bg = d.status !== "work" ? "bg-muted text-muted-foreground" : !ok ? "bg-[var(--claim-bad)]" : sun ? "bg-[var(--claim-sun)]" : "";
                          return (
                            <tr key={d.day} className={`border-t ${bg}`}>
                              <td className="px-2 py-1">{d.day}</td>
                              <td className="px-2 py-1 font-sans">{weekday(year, month, d.day)}</td>
                              {d.status === "work" ? (
                                <>
                                  <td className="px-2 py-1">{d.inTime}</td>
                                  <td className="px-2 py-1">{d.outTime}</td>
                                  {(["g", "ot"] as const).map((k) => (
                                    <td key={k} className="px-1 py-0.5">
                                      <Input type="number" step="0.5" value={d[k] ?? ""} aria-label={`${k} day ${d.day}`}
                                        onChange={(e) => onEdit(w.id, d.day, k, e.target.value === "" ? null : Number(e.target.value))}
                                        className="h-7 w-16 px-1 font-mono" />
                                    </td>
                                  ))}
                                  <td className="px-2 py-1 font-sans">
                                    {ok ? <span className="text-success">✓</span> : <span className="whitespace-nowrap rounded-full bg-warning/20 px-2 text-xs text-warning">Out does not match</span>}
                                  </td>
                                </>
                              ) : (
                                <td colSpan={5} className="px-2 py-1 font-sans italic">{d.status === "off" ? "OFF" : "Crossed out (not on site)"}</td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-sm bg-[var(--claim-sun)]" /> Sunday</span>
                    <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-sm bg-muted border" /> OFF or crossed</span>
                    <span className="flex items-center gap-1"><i className="h-3 w-3 rounded-sm bg-[var(--claim-bad)]" /> mismatch</span>
                  </div>
                  <div className="font-mono text-sm font-medium">{w.name}: {t.days} days · G-Hrs {t.g} · OT {t.ot} · total {t.total} hrs</div>
                </div>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
      <div className="mt-4 flex justify-between"><Button variant="outline" onClick={onBack}>Back</Button><Button onClick={onNext}>Looks good, show claim sheet →</Button></div>
      <DevNote>
        <p>Each row is checked with <code>rowMatches()</code>: Out − In − 1h break must equal G + OT.</p>
        <p>Edits update the worker in page state; tab chips and totals re-derive from it.</p>
      </DevNote>
    </div>
  );
}
