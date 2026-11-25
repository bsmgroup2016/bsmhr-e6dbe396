import { describe, expect, it } from "bun:test";
import { buildExcelAiWorkbook, ExcelAiCheckError } from "./excel-ai-workbook";
import { parseExcelAiReply, DEFAULT_EXCEL_AI_PLAN } from "@/core/excel-ai-plan";
import type { CompanyClaimSummary } from "@/core/company-claim-summary";

const summary: CompanyClaimSummary = {
  companyId: "c1", companyName: "BSM", companyCode: "BSM", sheets: [],
  projects: [{ key: "p1", label: "Site A", projectName: "Site A", siteName: "", clientName: "Client X", workers: 1, normalHours: 160, otHours: 40 }],
  workers: [{ key: "w1", code: "B-1", name: "ALI", projects: [{ key: "p1", label: "Site A", bDays: 20, sundays: 0, normalHours: 160, otHours: 40 }] }],
};
const salary = [{ Company: "BSM", "P-File number": "B-1", Name: "ALI", "G hours": 160, "OT hours": 40, "Net pay (SGD)": 1500, Status: "Approved" }];

describe("Excel AI workbook", () => {
  it("drops unknown AI dimensions and netPay on project rows", () => {
    const plan = parseExcelAiReply('```json {"pivots":[{"rows":"salary","measures":["gHours"]},{"rows":"project","measures":["netPay","otHours"]}],"otHoursAbove":72} ```');
    expect(plan.pivots).toEqual([{ title: "By project", rows: "project", measures: ["otHours"] }]);
    expect(plan.otHoursAbove).toBe(72);
  });
  it("keeps software hours and pay in formula results", async () => {
    const wb = await buildExcelAiWorkbook([summary], salary, DEFAULT_EXCEL_AI_PLAN, "2026-11");
    const pivot = wb.getWorksheet("PIVOT By company")!;
    expect((pivot.getCell("B2").value as { result: number }).result).toBe(160);
    expect((pivot.getCell("E2").value as { result: number }).result).toBe(1500);
  });
  it("refuses to export when salary hours disagree with claim data", async () => {
    await expect(buildExcelAiWorkbook([summary], [{ ...salary[0]!, "OT hours": 41 }], DEFAULT_EXCEL_AI_PLAN, "2026-11")).rejects.toBeInstanceOf(ExcelAiCheckError);
  });
});
