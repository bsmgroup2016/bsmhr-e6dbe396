import { test, expect } from "bun:test";
import ExcelJS from "exceljs";
import { claimTemplateLayout, selectClaimTemplate } from "./claim-template";
import { createClaimWorkbook } from "@/lib/combined-claim-export";
import { countedCardHours } from "./time-card-settlement";
import { fromTimeCard, toTimeCard } from "@/lib/db";

function blank(offset = 0) {
  const book = new ExcelJS.Workbook(); const page = book.addWorksheet("TEMPLATE");
  page.getCell(4, 2 + offset).value = "STAFF CODE";
  page.getCell(4, 3 + offset).value = "NAME";
  page.getCell(4, 4 + offset).value = "CATEGORY";
  page.getCell(4, 5 + offset).value = 1;
  page.getCell(5, 4 + offset).value = "G-HRS";
  page.getCell(6, 4 + offset).value = "OT HOURS";
  return { book, page };
}

test("replacement layout maps moved staff and daily hour columns rather than original coordinates", () => {
  const { page } = blank(2); const layout = claimTemplateLayout(page);
  expect(layout.codeCol).toBe(4); expect(layout.nameCol).toBe(5);
  expect(layout.days.get(1)).toBe(7); expect(layout.slots).toEqual([{ g: 5, ot: 6 }]);
});

test("blank TEMPLATE is selected instead of a sample sheet", () => {
  const { book } = blank(); book.addWorksheet("DEMO").getCell("A1").value = "SAMPLE WORKER";
  expect(selectClaimTemplate(book).name).toBe("TEMPLATE");
});

test("unknown replacement layout is rejected rather than silently generating the previous format", () => {
  const book = new ExcelJS.Workbook(); book.addWorksheet("Blank").getCell("A1").value = "Unmapped layout";
  expect(() => selectClaimTemplate(book)).toThrow("STAFF CODE");
});

test("claim output fills the replacement workbook and retains its formatting and template edits", async () => {
  const { book, page } = blank(2);
  page.mergeCells("D5:D6"); page.mergeCells("E5:E6");
  page.getCell("G5").numFmt = "0.00"; page.getColumn(7).width = 17;
  page.getCell("J1").value = "USER TEMPLATE EDIT";
  page.getCell("H5").value = { formula: "SUM(G5:G6)" };
  const input = await book.xlsx.writeBuffer();
  const bytes = new Uint8Array(input);
  const output = await createClaimWorkbook([{ id: "claim", reference: "C1", employeeId: "worker", periodStart: "2026-11-01", periodEnd: "2026-11-30", totalDays: 1, totalNormalHours: 8, totalOtHours: 3, snapshot: [{ date: "2026-11-01", projectName: "REAL SITE", normalHours: 8, otHours: 3, status: "Present" }] }], [{ id: "worker", employeeCode: "PC-22", name: "MD ABU SAYED" } as import("@/lib/types").Employee], [], "2026-11", { templateBuffer: bytes.buffer });
  const result = output.worksheets[0];
  expect(result?.getCell("D5").value).toBe("PC-22");
  expect(result?.getCell("E5").value).toBe("MD ABU SAYED");
  expect(result?.getCell("G5").value).toBe(8); expect(result?.getCell("G6").value).toBe(3);
  expect(result?.getCell("J1").value).toBe("USER TEMPLATE EDIT");
  expect(result?.getCell("G5").numFmt).toBe("0.00"); expect(result?.getColumn(7).width).toBe(17);
  expect(result?.getCell("D6").master.address).toBe("D5"); expect(result?.getCell("H5").formula).toBe("SUM(G5:G6)");
});

test("twenty workers at one site fill twenty distinct name code G-HRS and OT slots", async () => {
  const { book, page } = blank();
  const employees = Array.from({ length: 20 }, (_, i) => ({ id: `worker-${i}`, employeeCode: `P-${i + 1}`, name: `WORKER ${i + 1}` } as import("@/lib/types").Employee));
  for (let i = 0; i < 20; i++) { page.getCell(5 + i * 2, 4).value = "G-HRS"; page.getCell(6 + i * 2, 4).value = "OT HOURS"; }
  const claims = employees.map((employee, i) => ({ id: `claim-${i}`, reference: `C${i}`, employeeId: employee.id, periodStart: "2026-11-01", periodEnd: "2026-11-30", totalDays: 1, totalNormalHours: 8, totalOtHours: i + 1, snapshot: [{ date: "2026-11-01", site: "REAL SITE", normalHours: 8, otHours: i + 1, status: "Present" }] }));
  const bytes = new Uint8Array(await book.xlsx.writeBuffer());
  const output = await createClaimWorkbook(claims, employees, [], "2026-11", { templateBuffer: bytes.buffer });
  const saved = new ExcelJS.Workbook(); await saved.xlsx.load(await output.xlsx.writeBuffer());
  expect(saved.worksheets).toHaveLength(1);
  const result = saved.worksheets[0];
  for (let i = 0; i < 20; i++) {
    expect(result?.getCell(5 + i * 2, 2).value).toBe(`P-${i + 1}`);
    expect(result?.getCell(5 + i * 2, 3).value).toBe(`WORKER ${i + 1}`);
    expect(result?.getCell(5 + i * 2, 5).value).toBe(8);
    expect(result?.getCell(6 + i * 2, 5).value).toBe(i + 1);
  }
});

test("twenty workers cannot be silently truncated into a nineteen-slot template", async () => {
  const { book, page } = blank();
  for (let i = 0; i < 19; i++) { page.getCell(5 + i * 2, 4).value = "G-HRS"; page.getCell(6 + i * 2, 4).value = "OT HOURS"; }
  const claims = Array.from({ length: 20 }, (_, i) => ({ id: `c-${i}`, reference: `C${i}`, employeeId: `w-${i}`, periodStart: "2026-11-01", periodEnd: "2026-11-30", totalDays: 1, totalNormalHours: 8, totalOtHours: 0, snapshot: [{ date: "2026-11-01", site: "REAL SITE", normalHours: 8, otHours: 0, status: "Present" }] }));
  const bytes = new Uint8Array(await book.xlsx.writeBuffer());
  await expect(createClaimWorkbook(claims, [], [], "2026-11", { templateBuffer: bytes.buffer })).rejects.toThrow("20 workers but the template has only 19 slots");
});

test("Approved edited GW and OT survive storage mapping and fill the active template", async () => {
  const card: import("@/lib/types").TimeCard = { id: "reviewed", employeeId: "worker", periodStart: "2026-11-01", periodEnd: "2026-11-30", status: "Verified", entries: [{ date: "2026-11-01", checkIn: "07:00", checkOut: "20:00", normalHours: 7.5, otHours: 3.25, reviewApproved: true }] };
  const saved = fromTimeCard(JSON.parse(JSON.stringify({ id: card.id, ...toTimeCard(card) })));
  expect(saved.entries[0]?.reviewApproved).toBe(true);
  const entry = saved.entries[0];
  if (!entry) throw new Error("Missing reviewed entry");
  const hours = countedCardHours(entry);
  const { book } = blank(2);
  const bytes = new Uint8Array(await book.xlsx.writeBuffer());
  const workbook = await createClaimWorkbook([{ id: "claim", reference: "C1", employeeId: "worker", periodStart: card.periodStart, periodEnd: card.periodEnd, totalDays: 1, totalNormalHours: hours.normalHours, totalOtHours: hours.otHours, snapshot: [{ date: entry.date, ...hours, site: "REAL SITE", status: "Present" }] }], [{ id: "worker", employeeCode: "PC-22", name: "REVIEWED WORKER" } as import("@/lib/types").Employee], [], "2026-11", { templateBuffer: bytes.buffer });
  const downloaded = new ExcelJS.Workbook(); await downloaded.xlsx.load(await workbook.xlsx.writeBuffer());
  expect(downloaded.worksheets[0]?.getCell("G5").value).toBe(7.5);
  expect(downloaded.worksheets[0]?.getCell("G6").value).toBe(3.25);
});