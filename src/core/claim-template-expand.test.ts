import { describe, expect, it } from "bun:test";
import ExcelJS from "exceljs";
import { adjustFormulaForInsert, expandClaimSlots, shiftFormulaRows } from "./claim-template-expand";

describe("claim template row expansion", () => {
  it("keeps the last original worker's two-row total bounded when ten workers are added", () => {
    const book = new ExcelJS.Workbook();
    const page = book.addWorksheet("TEMPLATE");
    const slots = Array.from({ length: 15 }, (_, i) => ({ g: 5 + i * 2, ot: 6 + i * 2 }));
    page.getCell("AJ33").value = { formula: "SUM(E33:AI34)" };
    page.getCell("AK33").value = { formula: "SUM($E$33:$E$34)" };
    page.getCell("AL33").value = { formula: "E36*$D$37" };
    page.getCell("AJ1").value = { formula: "SUM(E5:AI34)" };
    page.getCell("AJ35").value = { formula: "SUM(E5:AI34)" };
    expandClaimSlots(page, slots, 10, 1);
    expect(page.getCell("AJ33").formula).toBe("SUM(E33:AI34)");
    expect(page.getCell("AK33").formula).toBe("SUM($E$33:$E$34)");
    expect(page.getCell("AJ35").formula).toBe("SUM(E35:AI36)");
    expect(page.getCell("AL33").formula).toBe("E56*$D$57");
    expect(page.getCell("AJ1").formula).toBe("SUM(E5:AI54)");
    expect(page.getCell("AJ55").formula).toBe("SUM(E5:AI54)");
  });
  it("copies a worker's formulas onto the new worker rows", () => {
    expect(shiftFormulaRows("=AJ33+AJ34", 2)).toBe("=AJ35+AJ36");
    expect(shiftFormulaRows("=SUM(E34:AI34)", 4)).toBe("=SUM(E38:AI38)");
    expect(shiftFormulaRows("=E36*$D$37", 2)).toBe("=E38*$D$37");
  });
  it("grows grand totals to include added workers and moves rows below", () => {
    // 15 slots end at row 34; 10 more workers = 20 inserted rows.
    expect(adjustFormulaForInsert("=SUM(AJ5:AJ34)", 35, 20)).toBe("=SUM(AJ5:AJ54)");
    expect(adjustFormulaForInsert("=E36*$D$37", 35, 20)).toBe("=E56*$D$57");
    expect(adjustFormulaForInsert("=AL29", 35, 20)).toBe("=AL29");
    // The last worker's own row total must not swallow the new rows.
    expect(adjustFormulaForInsert("=SUM(E34:AI34)", 35, 20)).toBe("=SUM(E34:AI34)");
  });
});
