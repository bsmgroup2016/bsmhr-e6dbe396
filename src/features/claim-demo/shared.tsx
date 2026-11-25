export function DevNote(_props: { children: React.ReactNode }) {
  return null;
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
