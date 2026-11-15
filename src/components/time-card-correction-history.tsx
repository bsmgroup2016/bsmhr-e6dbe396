import type { TimeCardEntry } from "@/lib/types";
import { readingFields } from "@/core/time-card-corrections";

const labels: Record<string, string> = { date: "Date", workerName: "Worker name", employeeCode: "Staff code", fin: "FIN", siteName: "Printed site", projectId: "Project ID", projectName: "Project", checkIn: "Clock in", checkOut: "Clock out", normalHours: "GW hours", otHours: "OT hours", resolution: "Resolution", remarks: "Notes" };
const value = (v: string | number | undefined) => v === undefined || v === "" ? "—" : String(v);
const time = (at: string) => new Date(at).toLocaleString("en-SG", { timeZone: "Asia/Singapore" }) + " SGT";

export function TimeCardCorrectionHistory({ entry }: { entry: TimeCardEntry }) {
  const audit = entry.correctionAudit;
  if (!audit) return null;
  return <details className="mt-2 border-t pt-2 text-xs">
    <summary className="cursor-pointer font-medium text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Correction history · {audit.revisions.length} verified{audit.pending ? " · Pending revalidation" : ""}</summary>
    <div className="mt-2 space-y-3 break-words">
      <div><p className="font-semibold">Original OCR / first recorded reading</p><dl className="mt-1 grid grid-cols-2 gap-1">{readingFields.filter(field => audit.original[field] !== undefined).map(field => <div key={field}><dt className="text-muted-foreground">{labels[field]}</dt><dd>{value(audit.original[field])}</dd></div>)}</dl></div>
      {audit.pending && <p role="status" className="text-warning">Edited {audit.editedAt ? time(audit.editedAt) : ""} · Not yet revalidated</p>}
      {audit.revisions.map((revision, index) => <div key={`${revision.verifiedAt}-${index}`} className="border-t pt-2"><p className="font-semibold">Revision {index + 1}</p><p>Corrected: {time(revision.correctedAt)}</p><p>Revalidated: {time(revision.verifiedAt)}</p><ul className="mt-1 space-y-1">{revision.changes.map(change => <li key={change.field}>{labels[change.field]}: {value(change.before)} → <strong>{value(change.after)}</strong></li>)}</ul>{!revision.changes.length && <p>Returned to the previous verified values.</p>}</div>)}
    </div>
  </details>;
}