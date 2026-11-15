import { expect, test } from "bun:test";
import { uncertaintyReason, unresolvedOcrEntries } from "./time-card-ocr-status";
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