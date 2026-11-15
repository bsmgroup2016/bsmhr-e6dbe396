import { expect, test } from "bun:test";
import { uncertaintyReason, unresolvedOcrEntries, revalidateOcrEntry, matchesOcrFilter } from "./time-card-ocr-status";
import type { TimeCard } from "@/lib/types";
import { readBatchState, writeBatchState } from "./time-card-batch-state";
test("uncertain OCR must be explicitly checked even after a manual hour edit", () => {
  const entry = { date: "2026-11-15", confidence: 0.45, normalHours: 8, otHours: 3.5 };
  expect(unresolvedOcrEntries([entry])).toHaveLength(1);
  expect(unresolvedOcrEntries([{ ...entry, ocrReviewed: true }])).toHaveLength(0);
});
test("reader conflicts are marked even with a high reported confidence", () => {
  expect(uncertaintyReason({ date: "2026-11-15", confidence: 0.97, remarks: "Readers disagree on month/year" })).toContain("disagree");
  expect(uncertaintyReason({ date: "2026-11-15", confidence: 0.97 })).toBeNull();
});
test("failed-only batches and interrupted retry states survive reload", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  writeBatchState(storage, { localCards: [], batchCardIds: [], pendingScans: [], month: "2026-11", projectId: "", failedMessages: ["card.pdf: Read failed"], scanStatuses: [{ id: "card.pdf", fileName: "card.pdf", status: "Reading", attempts: 2 }] });
  expect(readBatchState(storage)?.failedMessages).toEqual(["card.pdf: Read failed"]);
  expect(readBatchState(storage)?.scanStatuses?.[0]).toMatchObject({ status: "Failed", attempts: 2 });
});

const manualCard: TimeCard = { id: "manual", employeeId: "", periodStart: "2026-11-01", periodEnd: "2026-11-30", status: "Verified", entries: [{ date: "2026-11-15", confidence: 0.45, normalHours: 8, otHours: 3.5, reviewApproved: true }] };
test("manual revalidation clears uncertainty only for the checked row and requires fresh approval", () => {
  const result = revalidateOcrEntry({ ...manualCard, entries: [...manualCard.entries, { ...manualCard.entries[0], date: "2026-11-16" }] }, 0);
  expect(result.error).toBeNull();
  expect(result.card.entries[0]).toMatchObject({ ocrReviewed: true, confidence: 0.45, normalHours: 8, otHours: 3.5, reviewApproved: false });
  expect(result.card.status).toBe("Draft");
  expect(unresolvedOcrEntries(result.card.entries)).toHaveLength(1);
});
test("revalidation rejects invalid dates, duplicate dates, incomplete times and invalid hours", () => {
  for (const entries of [
    [{ ...manualCard.entries[0], date: "2026-11-31" }],
    [manualCard.entries[0], manualCard.entries[0]],
    [{ date: "2026-11-15", checkIn: "08:00" }],
    [{ ...manualCard.entries[0], otHours: -1 }],
  ]) {
    const original = { ...manualCard, entries };
    const result = revalidateOcrEntry(original, 0);
    expect(result.error).not.toBeNull();
    expect(result.card).toBe(original);
  }
});
test("OCR filters separately select errors, retries and unresolved uncertainty", () => {
  const flags = { error: true, retry: false, uncertain: false };
  expect(matchesOcrFilter("Errors", flags)).toBe(true);
  expect(matchesOcrFilter("Retry", flags)).toBe(false);
  expect(matchesOcrFilter("Uncertain", flags)).toBe(false);
  expect(matchesOcrFilter("Retry", { error: false, retry: true, uncertain: false })).toBe(true);
  expect(matchesOcrFilter("Uncertain", { error: false, retry: false, uncertain: true })).toBe(true);
  expect(matchesOcrFilter("Issues", { error: false, retry: false, uncertain: false })).toBe(false);
});