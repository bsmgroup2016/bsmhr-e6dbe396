import { expect, test } from "bun:test";
import ExcelJS from "exceljs";
import { claimCellValue, clearClaimFormulaResults, setClaimCell } from "./claim-workbook-editor";

test("Excel edits fill G-HRS and OT cells while preserving template style and merges", async () => {
  const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet("Project");
  sheet.mergeCells("B5:B6"); sheet.getCell("B5").value = "PC-22";
  sheet.getCell("E5").numFmt = "0.0"; sheet.getColumn(5).width = 12;
  expect(setClaimCell(sheet, "E5", "8.5")).toBe(true);
  expect(setClaimCell(sheet, "E6", "4")).toBe(true);
  expect(setClaimCell(sheet, "B6", "wrong")).toBe(false);
  const copy = new ExcelJS.Workbook(); await copy.xlsx.load(await book.xlsx.writeBuffer());
  const page = copy.worksheets[0];
  expect(page?.getCell("E5").value).toBe(8.5); expect(page?.getCell("E6").value).toBe(4);
  expect(page?.getCell("B6").master.address).toBe("B5"); expect(page?.getCell("B5").value).toBe("PC-22");
  expect(page?.getCell("E5").numFmt).toBe("0.0"); expect(page?.getColumn(5).width).toBe(12);
});

test("Excel edits retain unknown blanks and text identifiers", () => {
  expect(claimCellValue("")).toBeNull(); expect(claimCellValue("PC-22")).toBe("PC-22"); expect(claimCellValue("0012")).toBe("0012");
});

test("template calculations cannot be overwritten and stale results are cleared for recalculation", () => {
  const book = new ExcelJS.Workbook(); const sheet = book.addWorksheet("Project");
  sheet.getCell("AJ5").value = { formula: "SUM(E5:AI5)", result: 240 };
  expect(setClaimCell(sheet, "AJ5", "99")).toBe(false);
  clearClaimFormulaResults(book);
  expect(sheet.getCell("AJ5").value).toEqual({ formula: "SUM(E5:AI5)" });
  expect(book.calcProperties.fullCalcOnLoad).toBe(true);
});