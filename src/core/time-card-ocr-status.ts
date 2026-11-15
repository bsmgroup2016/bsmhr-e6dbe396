import type { TimeCard, TimeCardEntry } from "@/lib/types";
import { claimBatchProblem } from "./claim-batch-validation";

export interface CardScanStatus {
  id: string;
  fileName: string;
  status: "Queued" | "Reading" | "Read" | "Failed";
  attempts: number;
  workers?: number;
  days?: number;
  uncertain?: number;
  error?: string;
}

export function uncertaintyReason(entry: TimeCardEntry): string | null {
  const reasons: string[] = [];
  if (entry.confidence !== undefined && entry.confidence < 0.7) reasons.push(`Low confidence (${Math.round(entry.confidence * 100)}%)`);
  if (entry.suggestion) reasons.push("Alternative reading available");
  if (/disagree|differs|second reader|verify the original|unclear|uncertain/i.test(entry.remarks ?? "")) reasons.push(entry.remarks ?? "");
  return reasons.length ? [...new Set(reasons)].join(" · ") : null;
}

export function unresolvedOcrEntries(entries: TimeCardEntry[]) {
  return entries.filter(entry => uncertaintyReason(entry) && !entry.ocrReviewed);
}

export type OcrResultFilter = "All" | "Issues" | "Errors" | "Retry" | "Uncertain";

export function cardOcrFlags(card: TimeCard, scans: CardScanStatus[], month: string) {
  const related = scans.filter(scan => scan.id === `rescan:${card.id}` || scan.fileName === card.fileName);
  return { error: !!claimBatchProblem([card], month) || related.some(scan => scan.status === "Failed"), retry: related.some(scan => scan.status === "Failed" || scan.attempts > 1), uncertain: unresolvedOcrEntries(card.entries).length > 0 };
}

export function scanOcrFlags(scan: CardScanStatus) {
  return { error: scan.status === "Failed", retry: scan.status === "Failed" || scan.attempts > 1, uncertain: (scan.uncertain ?? 0) > 0 };
}

export function matchesOcrFilter(filter: OcrResultFilter, flags: { error: boolean; retry: boolean; uncertain: boolean }) {
  return filter === "All" || (filter === "Issues" && (flags.error || flags.retry || flags.uncertain)) ||
    (filter === "Errors" && flags.error) || (filter === "Retry" && flags.retry) || (filter === "Uncertain" && flags.uncertain);
}

/** Checking edited values never approves a card or upgrades the reader's confidence. */
export function revalidateOcrEntry(card: TimeCard, index: number): { card: TimeCard; error: string | null } {
  const entry = card.entries[index];
  if (!entry) return { card, error: "Entry not found" };
  const issue = claimBatchProblem([card], card.periodStart.slice(0, 7));
  if (issue) return { card, error: issue };
  if (card.entries.some(row => [row.normalHours, row.otHours].some(value => value !== undefined && (!Number.isFinite(value) || value < 0)))) {
    return { card, error: "GW and OT hours must be non-negative numbers" };
  }
  return { card: { ...card, status: "Draft", entries: card.entries.map((row, i) => ({ ...row, reviewApproved: false, ...(i === index ? { ocrReviewed: true } : {}) })) }, error: null };
}