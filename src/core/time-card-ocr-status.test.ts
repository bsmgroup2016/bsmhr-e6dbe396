import { expect, test } from "bun:test";
import { uncertaintyReason, unresolvedOcrEntries } from "./time-card-ocr-status";
test("uncertain OCR must be explicitly checked even after a manual hour edit", () => {
  const entry = { date: "2026-11-15", confidence: 0.45, normalHours: 8, otHours: 3.5 };
  expect(unresolvedOcrEntries([entry])).toHaveLength(1);
  expect(unresolvedOcrEntries([{ ...entry, ocrReviewed: true }])).toHaveLength(0);
});
test("reader conflicts are marked even with a high reported confidence", () => {
  expect(uncertaintyReason({ date: "2026-11-15", confidence: 0.97, remarks: "Readers disagree on month/year" })).toContain("disagree");
  expect(uncertaintyReason({ date: "2026-11-15", confidence: 0.97 })).toBeNull();
});