import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OT_MONTHLY_LIMIT } from "@/core/payslip-calc";
import type { ClaimDetails, Worker } from "./types";
import { batchTotals, isSunday, mismatchCount } from "./helpers";
import { DevNote, SummaryTiles } from "./shared";
import { downloadExcel, saveToRecords } from "./pipeline";
import { DEFAULT_RATE_PER_HOUR, downloadInvoiceBundle, downloadPayslips, suggestInvoiceNo } from "./claim-outputs";

export function StepExport({ workers, details, onBack, onRestart }: { workers: Worker[]; details: ClaimDetails; onBack: () => void; onRestart: () => void }) {
  const { month, site } = details;
  const [busy, setBusy] = useState<string | null>(null);
  const [invoiceNo, setInvoiceNo] = useState(() => suggestInvoiceNo(month));
  const [rate, setRate] = useState(String(DEFAULT_RATE_PER_HOUR));
  const overOt = workers.filter((w) => w.days.reduce((n, d) => n + (d.status === "work" ? d.ot ?? 0 : 0), 0) > OT_MONTHLY_LIMIT);
  const [y, m] = month.split("-").map(Number);
  const days = workers[0]?.days.length ?? 0;
  const mism = workers.reduce((s, w) => s + mismatchCount(w), 0);
  const unsure = workers.reduce((s, w) => s + w.flags.length, 0);
  const sundays = Array.from({ length: days }, (_, i) => i + 1).filter((d) => isSunday(y, m, d));
  const offs = [...new Set(workers.flatMap((w) => w.days.filter((d) => d.status === "off").map((d) => d.day)))];
  const checks: [boolean, string][] = [
    [workers.length > 0, `${workers.length} cards read with ${days} days`],
    [true, `Sundays ${sundays.join(", ")} detected${offs.length ? `; OFF days: ${offs.join(", ")}` : ""}`],
    [true, "Days not worked or crossed out are not counted as work days"],
    [mism === 0, `${mism} rows where In/Out do not match G+OT`],
    [unsure === 0, `${unsure} fields the AI was unsure about`],
    [overOt.length === 0, overOt.length ? `${overOt.length} worker(s) above ${OT_MONTHLY_LIMIT} OT hrs this month (needs MOM exemption): ${overOt.map((w) => w.code || w.name).join(", ")}` : `No worker above ${OT_MONTHLY_LIMIT} OT hrs`],
  ];
  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    try { await fn(); toast.success(ok); } catch (e) { toast.error(e instanceof Error ? e.message : "Something went wrong"); } finally { setBusy(null); }
  };
  const outs: [string, string, () => void][] = [
    ["Download Excel (.xlsx)", "Filled into your template, formulas kept", () => run("x", () => downloadExcel(workers, month, site), "Claim sheet downloaded")],
    ["PDF preview", "To send to the client", () => toast("PDF preview is not available yet")],
    ["Save to HR records", "Can be reopened and corrected later", () => run("s", () => saveToRecords(workers, month, site), "Saved to HR records")],
  ];
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4 rounded-[10px] border bg-card p-4">
          <h3 className="font-semibold">Checks before export</h3>
          <ul className="space-y-2 text-sm">
            {checks.map(([ok, t]) => (
              <li key={t} className="flex gap-2">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${ok ? "bg-success/15 text-success" : "bg-warning/20 text-warning"}`}>{ok ? "✓" : "!"}</span>{t}
              </li>
            ))}
          </ul>
          <SummaryTiles t={batchTotals(workers)} />
        </div>
        <div className="space-y-3 rounded-[10px] border bg-card p-4">
          <h3 className="font-semibold">Output</h3>
          {outs.map(([t, s, fn], i) => (
            <Button key={t} disabled={busy !== null} variant={i === 0 ? "default" : "outline"} className="h-auto w-full flex-col items-start py-3" onClick={fn}>
              <span className="flex items-center gap-2">{busy === (i === 0 ? "x" : i === 2 ? "s" : "") && <Loader2 className="h-4 w-4 animate-spin" />}{t}</span>
              <span className={`text-xs font-normal ${i === 0 ? "opacity-80" : "text-muted-foreground"}`}>{s}</span>
            </Button>
          ))}

          <div className="space-y-3 border-t pt-3">
            <h4 className="text-sm font-semibold">Payslip &amp; client billing</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="invoice-no" className="text-xs">Invoice number</Label>
                <Input id="invoice-no" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="invoice-rate" className="text-xs">Rate per hour ($)</Label>
                <Input id="invoice-rate" type="number" min="0" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
              </div>
            </div>
            <Button disabled={busy !== null} variant="outline" className="h-auto w-full flex-col items-start py-3"
              onClick={() => run("p", async () => {
                const r = await downloadPayslips(workers, month);
                if (r.missing.length) toast.warning(`Skipped ${r.missing.length}: ${r.missing.join("; ")}`);
                if (r.overLimit.length) toast.warning(`Above ${OT_MONTHLY_LIMIT} OT hrs (needs MOM exemption): ${r.overLimit.join("; ")}`);
              }, "Payslips downloaded")}>
              <span className="flex items-center gap-2">{busy === "p" && <Loader2 className="h-4 w-4 animate-spin" />}Generate payslip</span>
              <span className="text-xs font-normal text-muted-foreground">One PDF, a page per worker (MOM itemised format, draft: no allowances or deductions yet)</span>
            </Button>
            <Button disabled={busy !== null} variant="outline" className="h-auto w-full flex-col items-start py-3"
              onClick={() => run("i", () => downloadInvoiceBundle(workers, details, { invoiceNo, ratePerHour: Number(rate) }), "Invoice bundle downloaded")}>
              <span className="flex items-center gap-2">{busy === "i" && <Loader2 className="h-4 w-4 animate-spin" />}Generate invoice</span>
              <span className="text-xs font-normal text-muted-foreground">Tax invoice + claim sheet + time cards in one PDF for the client</span>
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-between"><Button variant="outline" onClick={onBack}>Back</Button><Button onClick={onRestart}>Start new month</Button></div>
      <DevNote><p>Download uses <code>downloadExcel()</code> and the current blank template; Save uses <code>saveToRecords()</code> in pipeline.ts.</p></DevNote>
    </div>
  );
}
