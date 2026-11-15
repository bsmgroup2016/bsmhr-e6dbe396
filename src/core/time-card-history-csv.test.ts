import { expect, test } from "bun:test";
import { cardHistoryCsv, historyCsvCell } from "./time-card-history-csv";
import { trackCardCorrection } from "./time-card-corrections";
import { revalidateOcrEntry } from "./time-card-ocr-status";
import type { TimeCard } from "@/lib/types";

const baseline = { date: "2026-11-15", employeeCode: "PC-22", workerName: 'WORKER, "ONE"', normalHours: 8, otHours: 3.5 };
const card: TimeCard = { id: "one", employeeId: "", status: "Draft", periodStart: "2026-11-01", periodEnd: "2026-11-30", entries: [baseline] };
test("CSV retains original OCR, corrected hours, successful revalidation and exact UTC times", () => {
  const edited = trackCardCorrection(baseline, { ...baseline, otHours: 4.5 }, "2026-11-15T18:29:00Z");
  const checked = revalidateOcrEntry({ ...card, entries: [edited] }, 0, "2026-11-15T18:30:00Z").card;
  const csv = cardHistoryCsv(checked);
  expect(csv).toContain('"OT hours","3.5","3.5","4.5","4.5","Passed","2026-11-15T18:29:00Z","2026-11-15T18:30:00Z"');
  expect(csv).toContain('"WORKER, ""ONE"""');
  expect(csv.startsWith("\uFEFF")).toBe(true);
});
test("CSV distinguishes pending invalid corrections and unavailable older OCR without inventing timestamps", () => {
  const edited = trackCardCorrection(baseline, { ...baseline, date: "2026-12-15" }, "2026-11-15T18:31:00Z");
  const csv = cardHistoryCsv({ ...card, entries: [edited] });
  expect(csv).toContain('"Pending correction"');
  expect(csv).toContain("current validation error");
  expect(csv).not.toContain('"Passed"');
  expect(cardHistoryCsv(card)).toContain("Original reading not recorded for this older entry");
});
test("CSV protects formula-like input and retains zero and multiline notes", () => {
  expect(historyCsvCell('=HYPERLINK("bad")')).toBe('"\'=HYPERLINK(""bad"")"');
  expect(historyCsvCell(" @SUM(1)")).toBe('"\' @SUM(1)"');
  expect(historyCsvCell(0)).toBe('"0"');
  expect(historyCsvCell("line 1\nline 2")).toBe('"line 1\nline 2"');
});