import { expect, test } from "bun:test";
import ExcelJS from "exceljs";
import { preserveManualReading, trackCardCorrection } from "./time-card-corrections";
import { revalidateOcrEntry, unresolvedOcrEntries } from "./time-card-ocr-status";
import { canGenerateSettledCards } from "./time-card-settlement";
import { fromTimeCard, toTimeCard } from "@/lib/db";
import { buildClaimSheetFromCard } from "@/lib/store";
import { createClaimWorkbook, reconcileClaimWorkbook } from "@/lib/combined-claim-export";
import type { TimeCard, TimeCardEntry } from "@/lib/types";

const original = { date: "2026-11-15", workerName: "OCR NAME", employeeCode: "PC-22", siteName: "OCR SITE", normalHours: 8, otHours: 3.5, confidence: 0.95 };
const card = (entry: TimeCardEntry = original): TimeCard => ({ id: "manual", employeeId: "", periodStart: "2026-11-01", periodEnd: "2026-11-30", status: "Draft", entries: [entry] });

test("high-confidence manual edits require revalidation and retain original OCR and correction times", () => {
  const edited = trackCardCorrection(original, { ...original, otHours: 4.5 }, "2026-11-15T18:29:00Z");
  expect(unresolvedOcrEntries([edited])).toHaveLength(1);
  expect(canGenerateSettledCards([{ ...card(edited), status: "Verified", entries: [{ ...edited, reviewApproved: true }] }], 0)).toBe(false);
  const verified = revalidateOcrEntry(card(edited), 0, "2026-11-15T18:30:00Z").card.entries[0];
  expect(verified?.correctionAudit).toMatchObject({ original: { otHours: 3.5 }, pending: false, revisions: [{ correctedAt: "2026-11-15T18:29:00Z", verifiedAt: "2026-11-15T18:30:00Z", changes: [{ field: "otHours", before: 3.5, after: 4.5 }] }] });
  if (!verified) throw new Error("Missing verified entry");
  const next = trackCardCorrection(verified, { ...verified, otHours: 5 }, "2026-11-15T18:31:00Z");
  const checked = revalidateOcrEntry(card(next), 0, "2026-11-15T18:32:00Z").card.entries[0];
  expect(checked?.correctionAudit?.original.otHours).toBe(3.5);
  expect(checked?.correctionAudit?.revisions[1].changes).toEqual([{ field: "otHours", before: 4.5, after: 5 }]);
});

test("failed revalidation never records a verified correction", () => {
  const edited = trackCardCorrection(original, { ...original, date: "2026-12-15" });
  const result = revalidateOcrEntry(card(edited), 0);
  expect(result.error).not.toBeNull();
  expect(result.card.entries[0].correctionAudit?.pending).toBe(true);
  expect(result.card.entries[0].correctionAudit?.revisions).toHaveLength(0);
});

test("retry OCR never replaces previously manually corrected values or their history", () => {
  const edited = trackCardCorrection(original, { ...original, otHours: 4.5 });
  const verified = revalidateOcrEntry(card(edited), 0).card.entries[0];
  const reread = preserveManualReading(verified, { ...original, otHours: 2, confidence: 0.4 });
  expect(reread.otHours).toBe(4.5);
  expect(reread.correctionAudit?.original.otHours).toBe(3.5);
  expect(reread.correctionAudit?.revisions).toHaveLength(1);
});

test("30 corrected cards survive persistence mapping and fill exact corrected date identity site and hours in downloaded Excel", async () => {
  const template = new ExcelJS.Workbook(); const p = template.addWorksheet("TEMPLATE");
  p.getCell("B4").value = "STAFF CODE"; p.getCell("C4").value = "NAME"; p.getCell("D4").value = "CATEGORY";
  p.getCell("E4").value = 15; p.getCell("F4").value = 16;
  p.getCell("D5").value = "G-HRS"; p.getCell("D6").value = "OT HOURS";
  const claims = Array.from({ length: 30 }, (_, i) => {
    const entry = trackCardCorrection(original, { ...original, date: "2026-11-16", workerName: `MANUAL ${i + 1}`, employeeCode: `P-${i + 1}`, siteName: "REAL SITE", normalHours: 7.5, otHours: i + 0.25 });
    const checked = revalidateOcrEntry({ ...card(entry), id: `card-${i}` }, 0).card;
    const approved = { ...checked, status: "Verified" as const, entries: checked.entries.map(row => ({ ...row, reviewApproved: true })) };
    const saved = fromTimeCard(JSON.parse(JSON.stringify({ id: approved.id, ...toTimeCard(approved) })));
    expect(saved.entries[0].correctionAudit?.original.otHours).toBe(3.5);
    expect(canGenerateSettledCards([saved], 0)).toBe(true);
    const snapshot = buildClaimSheetFromCard(saved);
    expect(snapshot[0]).toMatchObject({ date: "2026-11-16", workerName: `MANUAL ${i + 1}`, employeeCode: `P-${i + 1}`, site: "REAL SITE", normalHours: 7.5, otHours: i + 0.25 });
    return { id: saved.id, reference: saved.id, periodStart: saved.periodStart, periodEnd: saved.periodEnd, totalDays: 1, totalNormalHours: 7.5, totalOtHours: i + 0.25, snapshot };
  });
  const buffer = new Uint8Array(await template.xlsx.writeBuffer());
  const output = await createClaimWorkbook(claims, [], [], "2026-11", { templateBuffer: buffer.buffer });
  const downloaded = new ExcelJS.Workbook(); await downloaded.xlsx.load(await output.xlsx.writeBuffer());
  expect(reconcileClaimWorkbook(downloaded, claims, [], "2026-11")).toEqual([]);
  const page = downloaded.worksheets[0]; if (!page) throw new Error("Missing sheet");
  expect(page.getCell("A2").value).toBe("REAL SITE");
  for (let i = 0; i < 30; i++) {
    const row = 5 + i * 2;
    expect(page.getCell(row, 2).value).toBe(`P-${i + 1}`);
    expect(page.getCell(row, 3).value).toBe(`MANUAL ${i + 1}`);
    expect(page.getCell(row, 5).value).toBeNull();
    expect(page.getCell(row, 6).value).toBe(7.5);
    expect(page.getCell(row + 1, 6).value).toBe(i + 0.25);
  }
});