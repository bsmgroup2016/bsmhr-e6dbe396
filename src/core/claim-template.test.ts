import { test, expect } from "bun:test";
import ExcelJS from "exceljs";
import { claimTemplateLayout, selectClaimTemplate } from "./claim-template";

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