import { expect, test } from "bun:test";
import { PDFDocument } from "pdf-lib";
import { cardRowKey, groupTimeCardRows, splitTimeCardFile } from "./time-card-batch";

test("twenty workers sharing dates stay twenty independent cards", () => {
  const rows = Array.from({ length: 20 }, (_, index) => ({ cardIndex: index + 1, employeeCode: `P-${index + 1}`, workerName: `WORKER ${index + 1}`, siteName: "SITE A", date: "2026-11-01", checkIn: "08:00", checkOut: "18:00" }));
  const groups = groupTimeCardRows(rows);
  expect(groups).toHaveLength(20);
  expect(new Set(rows.map(cardRowKey)).size).toBe(20);
  groups.forEach((group, index) => { expect(group.identity.employeeCode).toBe(`P-${index + 1}`); expect(group.entries).toHaveLength(1); });
});

test("a twenty-page merged PDF yields twenty complete single-page PDFs", async () => {
  const source = await PDFDocument.create();
  for (let index = 0; index < 20; index++) source.addPage([300 + index, 500]);
  const pages = await splitTimeCardFile(new File([new Uint8Array(await source.save())], "merged.pdf", { type: "application/pdf" }));
  expect(pages).toHaveLength(20);
  for (const [index, file] of pages.entries()) {
    const page = await PDFDocument.load(await file.arrayBuffer());
    expect(page.getPageCount()).toBe(1);
    expect(page.getPages()[0]?.getWidth()).toBe(300 + index);
    expect(file.name).toBe(`merged-page-${index + 1}.pdf`);
  }
});

test("unreadable identities on different physical cards never merge", () => {
  expect(groupTimeCardRows([{ cardIndex: 1, date: "2026-11-01" }, { cardIndex: 2, date: "2026-11-01" }])).toHaveLength(2);
});

test("duplicate days in one physical card fail rather than double count", () => {
  expect(() => groupTimeCardRows([{ employeeCode: "P-1", date: "2026-11-01" }, { employeeCode: "P-1", date: "2026-11-01" }])).toThrow("Duplicate day");
});

test("one worker's different sites and months stay separate", () => {
  expect(groupTimeCardRows([{ employeeCode: "P-1", siteName: "A", date: "2026-11-01" }, { employeeCode: "P-1", siteName: "B", date: "2026-11-01" }, { employeeCode: "P-1", siteName: "A", date: "2026-12-01" }])).toHaveLength(3);
});
test("a fifty-page PDF retains all physical cards in reading order", async () => {
  const source = await PDFDocument.create();
  for (let i = 0; i < 50; i++) source.addPage([300 + i, 500]);
  const pages = await splitTimeCardFile(new File([new Uint8Array(await source.save())], "fifty.pdf", { type: "application/pdf" }));
  expect(pages).toHaveLength(50);
  const final = pages[49]; if (!final) throw new Error("Missing final card");
  expect((await PDFDocument.load(await final.arrayBuffer())).getPages()[0]?.getWidth()).toBe(349);
});