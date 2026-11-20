import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CheckResult } from "@/lib/claim-sheet-check";

/** Result of "Check claim sheet": what passed, what needs attention, and a fix-and-download for mechanical issues. */
export function ClaimCheckPanel({ result, busy, onFix, onDownload }: { result: CheckResult; busy: boolean; onFix: () => void; onDownload: () => void }) {
  const errors = result.issues.filter((i) => i.level === "error").length;
  return (
    <div className="space-y-3 rounded-[10px] border p-3 text-sm">
      <div className="font-medium">
        {result.issues.length === 0 ? "All checks passed" : `${errors} error(s), ${result.issues.length - errors} warning(s)`}
      </div>
      <ul className="space-y-1">
        {result.passed.map((p) => (
          <li key={p} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />{p}</li>
        ))}
      </ul>
      {result.issues.length > 0 && (
        <ul className="max-h-64 space-y-1.5 overflow-y-auto">
          {result.issues.map((i, n) => (
            <li key={n} className="flex gap-2">
              {i.level === "error" ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />}
              <span>
                <span className="font-mono text-xs text-muted-foreground">{i.sheet === "all" ? "" : `${i.sheet}${i.cell ? `!${i.cell}` : ""} `}</span>
                {i.message}
                {i.fix && <span className="ml-1 text-xs text-primary">(can fix)</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {result.fixable > 0 && <Button size="sm" disabled={busy} onClick={onFix}>Fix {result.fixable} item(s) &amp; download</Button>}
        <Button size="sm" variant={result.fixable > 0 ? "outline" : "default"} disabled={busy} onClick={onDownload}>
          {result.issues.length ? "Download as is" : "Download Excel"}
        </Button>
      </div>
      {result.issues.some((i) => !i.fix) && (
        <p className="text-xs text-muted-foreground">Items without "can fix" need a person: fix the hours in Review, the site in Projects &amp; Sites, or the blank template, then check again.</p>
      )}
    </div>
  );
}
