import { describe, expect, it } from "bun:test";
import { adjustFormulaForInsert, shiftFormulaRows } from "./claim-template-expand";

describe("claim template row expansion", () => {
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
