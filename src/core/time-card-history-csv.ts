import type { TimeCard, TimeCardReading } from "@/lib/types";
import { readingFields } from "./time-card-corrections";
import { claimBatchProblem } from "./claim-batch-validation";

const labels: Record<keyof TimeCardReading, string> = { date: "Date", workerName: "Worker name", employeeCode: "Staff code", fin: "FIN", siteName: "Printed site", projectId: "Project ID", projectName: "Project", checkIn: "Clock in", checkOut: "Clock out", normalHours: "GW hours", otHours: "OT hours", resolution: "Resolution", remarks: "Notes" };
type Cell = string | number | undefined;

/** Quote every cell, preserve Unicode/zero, and prevent spreadsheet formula execution. */
export function historyCsvCell(value: Cell): string {
  let text = value === undefined ? "" : String(value);
  if (typeof value === "string" && /^\s*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function cardHistoryCsv(card: TimeCard): string {
  const rows: Cell[][] = [["Card ID", "Source file", "Entry number", "Current date", "Staff code", "Worker name", "Event", "Revision", "Field", "Original OCR / first reading", "Previous value", "Event value", "Current value", "Revalidation result", "Corrected at (UTC)", "Revalidated at (UTC)", "Card status"]];
  const issue = claimBatchProblem([card], card.periodStart.slice(0, 7));
  card.entries.forEach((entry, index) => {
    const audit = entry.correctionAudit;
    const prefix: Cell[] = [card.id, card.fileName, index + 1, entry.date, entry.employeeCode, entry.workerName];
    const original = audit?.original;
    const previous: TimeCardReading = { ...(original ?? { date: entry.date }) };
    const append = (event: string, revision: number | undefined, field: keyof TimeCardReading, before: Cell, after: Cell, result: string, correctedAt?: string, verifiedAt?: string) => {
      rows.push([...prefix, event, revision, labels[field], original?.[field], before, after, entry[field], result, correctedAt, verifiedAt, card.status]);
    };
    // Include every field, even blanks, so no date or original value is omitted.
    for (const field of readingFields) append("Original reading", undefined, field, undefined, original?.[field], original ? "Recorded baseline" : "Original reading not recorded for this older entry");
    audit?.revisions.forEach((revision, revisionIndex) => {
      if (!revision.changes.length) append("Verified correction", revisionIndex + 1, "date", previous.date, previous.date, "Passed - returned to previous verified values", revision.correctedAt, revision.verifiedAt);
      for (const change of revision.changes) {
        append("Verified correction", revisionIndex + 1, change.field, change.before, change.after, "Passed", revision.correctedAt, revision.verifiedAt);
        Object.assign(previous, { [change.field]: change.after });
      }
    });
    if (audit?.pending) {
      for (const field of readingFields.filter(field => previous[field] !== entry[field])) append("Pending correction", undefined, field, previous[field], entry[field], issue ? `Pending - current validation error: ${issue}` : "Pending - not revalidated", audit.editedAt);
    }
    const result = issue ? `Current validation error: ${issue}` : audit?.pending ? "Pending - not revalidated" : entry.ocrReviewed ? "Checked against original" : "Not checked against original";
    for (const field of readingFields) append("Current information", undefined, field, undefined, entry[field], result);
  });
  return "\uFEFF" + rows.map(row => row.map(historyCsvCell).join(",")).join("\r\n") + "\r\n";
}