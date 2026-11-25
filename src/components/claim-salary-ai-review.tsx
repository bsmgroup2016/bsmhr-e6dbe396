import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Brain, Loader2 } from "lucide-react";
import { CLAIM_SALARY_REVIEW_PROMPT, runClaimSalaryReview, type ReviewSnapshot } from "@/core/claim-salary-review";
import { callHrBrain } from "@/lib/hrBrain";
import { useAuth } from "@/lib/auth";

/** Screen-only advisory results. Export paths never consume this component's output. */
export function ClaimSalaryAiReview({ snapshot }: { snapshot: ReviewSnapshot }) {
  const { user, roles } = useAuth();
  const payload = JSON.stringify(snapshot);
  const [readyPayload, setReadyPayload] = useState("");
  const allowed = !!user && roles.some(role => ["admin", "hr", "manager", "accounts", "it"].includes(role));
  useEffect(() => {
    const timer = setTimeout(() => setReadyPayload(payload), 750);
    return () => clearTimeout(timer);
  }, [payload]);
  const review = useQuery({
    queryKey: ["claim-salary-ai-review", user?.id, payload],
    enabled: allowed && snapshot.records.length > 0 && readyPayload === payload,
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    retry: false,
    queryFn: ({ signal }) => runClaimSalaryReview(snapshot, async batch => {
      signal.throwIfAborted();
      const response = await callHrBrain({
        systemPrompt: CLAIM_SALARY_REVIEW_PROMPT,
        messages: [{ role: "user", content: `Recheck these ${snapshot.kind === "salary" ? "saved salary" : "claim summary"} records.\n${JSON.stringify(batch)}` }],
        stream: false, max_tokens: 2048, temperature: 0.1,
      }, AbortSignal.any([signal, AbortSignal.timeout(60_000)]));
      const choice = response.choices?.[0];
      if (choice?.finish_reason === "length") throw new Error("The AI review was incomplete.");
      return choice?.message?.content ?? "";
    }),
  });
  if (!allowed || snapshot.records.length === 0) return null;
  return <section aria-label="Automatic AI recheck" className="space-y-3 border-t pt-4">
    <h2 className="flex items-center gap-2 text-base font-semibold"><Brain className="h-4 w-4 text-primary" />Automatic recheck</h2>
    {snapshot.warnings.length > 0 && <div className="flex gap-2 text-sm text-warning">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <ul className="list-disc space-y-1 pl-4">{snapshot.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul>
    </div>}
    {review.isError ? <p role="status" className="text-sm text-destructive">AI recheck unavailable. These records have not been verified by AI; downloads remain available.</p>
      : review.data ? <div className="max-h-80 space-y-4 overflow-y-auto text-sm">
        {review.data.map((text, index) => <div key={index} className="space-y-1">
          {review.data.length > 1 && <h3 className="font-medium">Review {index + 1} of {review.data.length}</h3>}
          {text.split("\n").filter(line => line.trim()).map((line, lineIndex) => {
            const clean = line.replace(/^#{1,6}\s*/, "").replace(/\*\*/g, "");
            const bullet = /^\s*[-*]\s/.test(clean);
            return <p key={lineIndex} className={bullet ? "pl-3" : "font-medium"}>{bullet ? `• ${clean.replace(/^\s*[-*]\s/, "")}` : clean}</p>;
          })}
        </div>)}
      </div>
      : <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking {snapshot.records.length} worker records…</p>}
    <p className="text-xs text-muted-foreground">Advisory only · Current filtered records · Original Excel format and saved calculations unchanged</p>
  </section>;
}