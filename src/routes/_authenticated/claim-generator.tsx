import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/app-shell";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ClaimDetails, Worker } from "@/features/claim-demo/types";
import { StepUpload } from "@/features/claim-demo/step-upload";
import { StepReview } from "@/features/claim-demo/step-review";
import { StepClaim } from "@/features/claim-demo/step-claim";
import { StepExport } from "@/features/claim-demo/step-export";
import { readCards, recoverCards } from "@/features/claim-demo/pipeline";
import { clearPendingTimeCardJobs } from "@/lib/ocr";
import { activeClaimTemplate, loadClaimTemplate, saveClaimTemplate } from "@/lib/claim-template";

export const Route = createFileRoute("/_authenticated/claim-generator")({
  head: () => ({
    meta: [
      { title: "Timecard to ClaimSheet — BSM HR" },
      { name: "description", content: "Turn scanned work record cards into a monthly claim sheet." },
      { property: "og:title", content: "Timecard to ClaimSheet — BSM HR" },
      { property: "og:description", content: "Turn scanned work record cards into a monthly claim sheet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClaimGeneratorPage,
});

const STEPS = ["Upload", "Review", "Claim sheet", "Export"];
const DEFAULT_TEMPLATE = "Claim_Sheet_Blank.xlsx";
const emptyDetails = (): ClaimDetails => ({ client: "", site: "", month: new Date().toISOString().slice(0, 7) });

function ClaimGeneratorPage() {
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [details, setDetails] = useState<ClaimDetails>(emptyDetails);
  const [files, setFiles] = useState<File[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [failed, setFailed] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recoveryStarted = useRef(false);
  const [y, m] = details.month.split("-").map(Number);

  useEffect(() => { activeClaimTemplate().then((t) => t && setTemplate(t.original_name)).catch(() => {}); }, []);

  useEffect(() => {
    if (recoveryStarted.current) return;
    recoveryStarted.current = true;
    void recoverCards((done, total) => setProgress({ done, total })).then(r => {
      if (r.failed.length) setFailed(r.failed);
      if (!r.workers.length) return;
      setWorkers(r.workers);
      setDetails(d => ({ ...d, site: r.site || d.site, month: r.month || d.month }));
      setStep(1); setReached(1);
    }).catch(error => toast.error(error instanceof Error ? error.message : "Could not recover OCR results")).finally(() => setProgress(null));
  }, []);

  const go = (n: number) => { setStep(n); setReached((r) => Math.max(r, n)); };
  const edit = (wid: string, day: number, key: "g" | "ot", v: number | null) =>
    setWorkers((ws) => ws.map((w) => (w.id !== wid ? w : { ...w, days: w.days.map((d) => (d.day === day ? { ...d, [key]: v } : d)) })));

  async function read() {
    setProgress({ done: 0, total: 0 }); setFailed([]);
    try {
      await clearPendingTimeCardJobs();
      const r = await readCards(files, (done, total) => setProgress({ done, total }));
      setFailed(r.failed);
      if (!r.workers.length) { toast.error("No time cards could be read"); return; }
      workers.forEach((w) => URL.revokeObjectURL(w.preview));
      setWorkers(r.workers);
      setDetails((d) => ({ ...d, site: d.site || r.site, month: r.month || d.month }));
      if (r.failed.length) toast.error(`${r.failed.length} page(s) could not be read`);
      toast.success(`${r.workers.length} Work Record Card(s) found`);
      go(1);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not read the cards"); }
    finally { setProgress(null); }
  }

  function restart() { void clearPendingTimeCardJobs(); workers.forEach((w) => URL.revokeObjectURL(w.preview)); setWorkers([]); setFiles([]); setFailed([]); setDetails(emptyDetails()); setStep(0); setReached(0); }

  async function downloadTemplate() {
    try {
      const buf = await loadClaimTemplate();
      const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const a = document.createElement("a"); a.href = url; a.download = template; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not download the template"); }
  }

  return (
    <AppShell>
    <div className="claim-demo rounded-[10px] p-4 md:p-6">
      <div className="mb-2 flex justify-end">
        <div className="flex">
          <Button variant="outline" className="rounded-r-none" onClick={() => fileRef.current?.click()}>Change template</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="rounded-l-none border-l-0" aria-label="Template options"><ChevronDown className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="font-normal"><div className="text-xs text-muted-foreground">Currently using</div><div className="text-sm">{template}</div></DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => void downloadTemplate()}>Download template</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; e.target.value = "";
            if (!f) return;
            try { const saved = await saveClaimTemplate(f); setTemplate(saved?.original_name ?? f.name); toast.success(`Template changed to ${f.name}`); }
            catch (err) { toast.error(err instanceof Error ? err.message : "Could not change the template"); }
          }} />
        </div>
      </div>
      <h1 className="text-2xl font-semibold">Timecard to ClaimSheet</h1>
      <p className="mb-4 text-sm text-muted-foreground">Upload scanned work record cards, check the hours, and get the monthly claim sheet.</p>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {STEPS.map((s, i) => {
          const done = i < step, active = i === step, disabled = i > reached || progress !== null;
          return (
            <button key={s} type="button" disabled={disabled} onClick={() => setStep(i)}
              className={`flex items-center gap-3 rounded-[10px] border bg-card p-3 text-left disabled:opacity-50 ${active ? "border-2 border-primary" : ""}`}>
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${done ? "bg-success text-success-foreground" : active ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className="text-sm font-medium">{s}</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-[10px] border bg-card p-4 md:p-5">
        {step === 0 && <StepUpload files={files} setFiles={setFiles} details={details} setDetails={setDetails} progress={progress} failed={failed} onRead={() => void read()} />}
        {step === 1 && <StepReview workers={workers} year={y} month={m} onEdit={edit} onBack={() => setStep(0)} onNext={() => go(2)} />}
        {step === 2 && <StepClaim workers={workers} details={details} year={y} month={m} onBack={() => setStep(1)} onNext={() => go(3)} />}
        {step === 3 && <StepExport workers={workers} details={details} onBack={() => setStep(2)} onRestart={restart} />}
      </div>
    </div>
    </AppShell>
  );
}
