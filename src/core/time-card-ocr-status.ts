import type { TimeCardEntry } from "@/lib/types";

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