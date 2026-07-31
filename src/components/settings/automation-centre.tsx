import { useState } from "react";
import { Bot, Play, FlaskConical, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { runAutomationsNow, type AutomationRunResult } from "@/lib/automation";

const JOBS = [
  { title: "ডকুমেন্ট অটো-এক্সপায়ার", detail: "মেয়াদ শেষ হওয়া পারমিট/পাসপোর্ট স্বয়ংক্রিয়ভাবে Expired হয়ে যায়।" },
  { title: "টায়ার্ড এক্সপায়ারি রিমাইন্ডার", detail: "৯০ / ৬০ / ৩০ / ৭ দিন আগে HR-কে ইমেইল নোটিশ।" },
  { title: "মিসিং ক্লক-ইন অ্যালার্ট", detail: "আজ পাঞ্চ না করা সাইট ওয়ার্কারদের তালিকা।" },
  { title: "IR21 ট্যাক্স ক্লিয়ারেন্স", detail: "লিভার ফরেন এমপ্লয়ির IR21 ফ্ল্যাগ ও ডেডলাইন সতর্কতা।" },
  { title: "DRC কোটা ও লেভি ওয়ার্নিং", detail: "কম্পানি ভিত্তিক কোটা ব্রিচ ও মাসিক লেভি এক্সপোজার।" },
  { title: "মাস-শেষে পেরোল ড্রাফট", detail: "অ্যাটেনডেন্স থেকে OT, CPF/SDL/SHG ও লোন কেটে ড্রাফট তৈরি।" },
];

const rows = (r: AutomationRunResult) => [
  ["ডকুমেন্ট Expired করা হয়েছে", r.documentsExpired],
  ["এক্সপায়ারি রিমাইন্ডার", r.remindersQueued],
  ["ক্লক-ইন করেনি", r.missingClockIn],
  ["IR21 পেন্ডিং", r.ir21Pending],
  ["IR21 নতুন ফ্ল্যাগ", r.ir21Flagged],
  ["কোটা / লেভি ওয়ার্নিং", r.quotaWarnings],
  [`পেরোল ড্রাফট (${r.payrollMonth ?? "—"})`, r.payrollDraftsCreated],
  ["পেরোল স্কিপ", r.payrollSkipped],
  ["ইমেইল পাঠানো হয়েছে", r.sent],
] as const;

export function AutomationCentre() {
  const [busy, setBusy] = useState<"dry" | "live" | null>(null);
  const [result, setResult] = useState<AutomationRunResult | null>(null);
  const [mode, setMode] = useState<"dry" | "live">("dry");
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "dry" | "live") {
    setBusy(kind);
    setError(null);
    try {
      const r = await runAutomationsNow({ dryRun: kind === "dry", forcePayroll: true });
      setResult(r);
      setMode(kind);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Automation run failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border/60 bg-card/60 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="rounded-lg bg-primary/10 p-2 text-primary">
              <Bot className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-medium text-foreground">অটোমেশন সেন্টার</h3>
              <p className="text-sm text-muted-foreground">
                শিডিউল: প্রতিদিন সকাল ৮টা (SGT) — ডেটাবেস cron থেকে অটো চলে। এখান থেকে হাতে-কলমে টেস্ট বা তৎক্ষণাৎ রান করাও যায়।
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => run("dry")} disabled={busy !== null}>
              {busy === "dry" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FlaskConical className="mr-2 h-4 w-4" />}
              ড্রাই রান
            </Button>
            <Button onClick={() => run("live")} disabled={busy !== null}>
              {busy === "live" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              এখনই চালাও
            </Button>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

        {result && (
          <div className="mt-5 space-y-3">
            {result.emailError && (
              <p className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
                জব চলেছে, তবে ডাইজেস্ট ইমেইল পাঠানো যায়নি: {result.emailError}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Badge variant={mode === "dry" ? "secondary" : "default"}>
                {mode === "dry" ? "ড্রাই রান — কিছু লেখা হয়নি" : "লাইভ রান সম্পন্ন"}
              </Badge>
              <span className="text-xs text-muted-foreground">{result.date}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rows(result).map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg border border-border/50 bg-background/50 px-3 py-2"
                >
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-semibold text-foreground">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {JOBS.map((j) => (
          <div key={j.title} className="rounded-lg border border-border/50 bg-card/40 p-4">
            <p className="text-sm font-medium text-foreground">{j.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{j.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
