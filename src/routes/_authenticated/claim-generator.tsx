import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MOCK_DETAILS, TEMPLATE_FILE, mockWorkers } from "@/features/claim-demo/mock-data";
import type { ClaimDetails, Worker } from "@/features/claim-demo/types";
import { StepUpload } from "@/features/claim-demo/step-upload";
import { StepReview } from "@/features/claim-demo/step-review";
import { StepClaim } from "@/features/claim-demo/step-claim";
import { StepExport } from "@/features/claim-demo/step-export";

export const Route = createFileRoute("/_authenticated/claim-generator")({
  head: () => ({
    meta: [
      { title: "Claim Sheet Generator (Demo) — BSM HR" },
      { name: "description", content: "Turn scanned work record cards into a monthly claim sheet." },
      { property: "og:title", content: "Claim Sheet Generator (Demo) — BSM HR" },
      { property: "og:description", content: "Turn scanned work record cards into a monthly claim sheet." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClaimGeneratorPage,
});

const STEPS = ["Upload", "Review", "Claim sheet", "Export"];

function ClaimGeneratorPage() {
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [template, setTemplate] = useState(TEMPLATE_FILE);
  const [details, setDetails] = useState<ClaimDetails>(MOCK_DETAILS);
  const [workers, setWorkers] = useState<Worker[]>(mockWorkers);
  const fileRef = useRef<HTMLInputElement>(null);
  const [y, m] = details.month.split("-").map(Number);

  const go = useCallback((n: number) => { setStep(n); setReached((r) => Math.max(r, n)); }, []);
  const toReview = useCallback(() => go(1), [go]);
  const edit = (wid: string, day: number, key: "g" | "ot", v: number | null) =>
    setWorkers((ws) => ws.map((w) => (w.id !== wid ? w : { ...w, days: w.days.map((d) => (d.day === day ? { ...d, [key]: v } : d)) })));

  return (
    <div className="claim-demo -m-4 min-h-full p-4 md:-m-6 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="text-sm text-muted-foreground">HR Software / Projects / <span className="text-foreground">Claims</span></nav>
        <div className="flex">
          <Button variant="outline" className="rounded-r-none" onClick={() => fileRef.current?.click()}>Change template</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="rounded-l-none border-l-0" aria-label="Template options"><ChevronDown className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="font-normal"><div className="text-xs text-muted-foreground">Currently using</div><div className="text-sm">{template}</div></DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => toast("Download template: demo only for now")}>Download template</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) { setTemplate(f.name); toast.success(`Template changed to ${f.name}`); }
            e.target.value = "";
          }} />
        </div>
      </div>
      <h1 className="text-2xl font-semibold">Claim Sheet Generator</h1>
      <p className="mb-4 text-sm text-muted-foreground">Upload scanned work record cards, check the hours, and get the monthly claim sheet.</p>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {STEPS.map((s, i) => {
          const done = i < step, active = i === step, disabled = i > reached;
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
        {step === 0 && <StepUpload details={details} setDetails={setDetails} onDone={toReview} />}
        {step === 1 && <StepReview workers={workers} year={y} month={m} onEdit={edit} onBack={() => setStep(0)} onNext={() => go(2)} />}
        {step === 2 && <StepClaim workers={workers} details={details} year={y} month={m} onBack={() => setStep(1)} onNext={() => go(3)} />}
        {step === 3 && <StepExport workers={workers} onBack={() => setStep(2)} onRestart={() => { setWorkers(mockWorkers()); setStep(0); setReached(0); }} />}
      </div>
    </div>
  );
}
