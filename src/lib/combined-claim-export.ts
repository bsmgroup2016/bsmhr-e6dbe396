import template from "@/assets/combined-claim-layout.asset.json";
import type { ClaimSheet, Employee } from "@/lib/types";
export async function exportCombinedClaims(sheets: ClaimSheet[], employees: Employee[], title: string) {
  if (!sheets.length) throw new Error("No claim sheets in this period");
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const response = await fetch(template.url);
  if (!response.ok) throw new Error("Could not load the claim sheet layout");
  await workbook.xlsx.load(await response.arrayBuffer());
  const page = workbook.worksheets[0];
  if (!page) throw new Error("Claim layout is missing");
  page.getCell("B1").value = title;
  const groups = new Map<string, ClaimSheet[]>();
  for (const sheet of sheets) { const key = sheet.employeeId ?? ""; groups.set(key, [...(groups.get(key) ?? []), sheet]); }
  let row = 4;
  for (const [employeeId, claims] of groups) {
    const employee = employees.find((item) => item.id === employeeId);
    page.getCell(`B${row}`).value = row - 3;
    page.getCell(`C${row}`).value = employee?.employeeCode ?? "";
    page.getCell(`D${row}`).value = employee?.name ?? "";
    const projects = new Map<string, { days: Set<string>; ot: number; normal: number }>();
    for (const claim of claims) for (const entry of claim.snapshot) {
      const key = entry.projectName ?? entry.site ?? "Project not confirmed";
      const value = projects.get(key) ?? { days: new Set<string>(), ot: 0, normal: 0 };
      value.days.add(entry.date); value.ot += entry.otHours; value.normal += entry.normalHours; projects.set(key, value);
    }
    if (projects.size > 6) throw new Error("This sample supports six project groups per worker. Split the period before exporting.");
    let index = 0;
    for (const [project, value] of projects) {
      const col = 5 + index * 4;
      page.getCell(row, col).value = project;
      page.getCell(row, col + 1).value = value.days.size;
      page.getCell(row, col + 2).value = value.ot;
      index++;
    }
    page.getCell(`AC${row}`).value = [...projects.values()].reduce((sum, item) => sum + item.normal, 0);
    const overtime = [...projects.values()].reduce((sum, item) => sum + item.ot, 0);
    const basic = [...projects.values()].reduce((sum, item) => sum + item.normal, 0);
    page.getCell(`AD${row}`).value = { formula: `SUM(G${row},K${row},O${row},S${row},W${row},AA${row})`, result: overtime };
    page.getCell(`AE${row}`).value = { formula: `AC${row}+AD${row}`, result: basic + overtime };
    page.getCell(`AI${row}`).value = new Set(claims.flatMap((claim) => claim.snapshot.map((entry) => entry.date))).size;
    page.getCell(`AM${row}`).value = "Billing rates, costs and MRT require confirmation";
    for (let col = 2; col <= 43; col++) { page.getCell(row, col).font = { name: "Arial", size: 10 }; page.getCell(row, col).alignment = { vertical: "middle", wrapText: true }; }
    page.getRow(row).height = 42;
    row++;
  }
  page.getCell(`B${row}`).value = "TOTAL";
  for (const col of ["AC", "AD", "AE", "AI"]) {
    let total = 0;
    for (let r = 4; r < row; r++) { const cell = page.getCell(`${col}${r}`); total += Number(cell.result ?? cell.value ?? 0); }
    page.getCell(`${col}${row}`).value = { formula: `SUM(${col}4:${col}${row - 1})`, result: total };
  }
  page.pageSetup.printArea = `B1:AQ${row}`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "combined_claim_sheet.xlsx"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}