import template from "@/assets/combined-claim-layout.asset.json";
import type { ClaimSheet, Company, Employee } from "@/lib/types";

/** Sample layout: project slots E..AB (4 cols each). Slots 1-4 = PLUTO, 5-6 = BSM. */
const SLOT_COLS = [5, 9, 13, 17, 21, 25];
type Group = "PLUTO" | "BSM" | "VRL";

function companyGroup(company?: Company): Group {
  const text = `${company?.code ?? ""} ${company?.name ?? ""}`.toUpperCase();
  if (text.includes("BSM")) return "BSM";
  if (text.includes("VRL")) return "VRL";
  return "PLUTO";
}

export function claimSheetTitle(companyName: string, month: string) {
  const [y, m] = month.split("-").map(Number);
  const label = y && m ? new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-SG", { month: "long", year: "numeric", timeZone: "UTC" }).toUpperCase() : month;
  return `${companyName.toUpperCase()} COMBINED SHEET -${label}`;
}

export async function exportCombinedClaims(sheets: ClaimSheet[], employees: Employee[], title: string, companies: Company[] = []) {
  if (!sheets.length) throw new Error("No claim sheets in this period");
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const response = await fetch(template.url);
  if (!response.ok) throw new Error("Could not load the claim sheet layout");
  await workbook.xlsx.load(await response.arrayBuffer());
  const page = workbook.worksheets[0];
  if (!page) throw new Error("Claim layout is missing");
  page.name = "COMBINED SHEET";
  page.getCell("B1").value = title;
  // Header labels exactly as the sample
  const heads = ["PROJECT 1 (PLUTO)", "PROJECT 2 (PLUTO)", "PROJECT 3 (PLUTO)", "PROJECT 4 (PLUTO)", "PROJECT 1 (BSM)", "PROJECT 2 (BSM)"];
  SLOT_COLS.forEach((col, i) => {
    page.getCell(2, col).value = heads[i];
    page.getCell(3, col + 1).value = "B DAY ";
    page.getCell(3, col + 2).value = "CLAIM SHEET OT ";
    page.getCell(3, col + 3).value = "BILL AMT S$";
  });

  const groups = new Map<string, ClaimSheet[]>();
  for (const sheet of sheets) { const key = sheet.employeeId ?? ""; groups.set(key, [...(groups.get(key) ?? []), sheet]); }
  const usedSlots = new Set<number>([0]);
  let row = 4;
  for (const [employeeId, claims] of groups) {
    const employee = employees.find((item) => item.id === employeeId);
    page.getCell(`B${row}`).value = row - 3;
    page.getCell(`C${row}`).value = employee?.employeeCode ?? "";
    page.getCell(`D${row}`).value = (employee?.name ?? "").toUpperCase();
    const projects = new Map<string, { group: Group; days: Set<string>; ot: number }>();
    let vrlDays = 0;
    for (const claim of claims) {
      const group = companyGroup(companies.find((c) => c.id === claim.companyId));
      for (const entry of claim.snapshot) {
        if (!entry.normalHours && !entry.otHours) continue;
        const name = (entry.projectName ?? entry.site ?? "PROJECT NOT CONFIRMED").toUpperCase();
        const key = `${group}|${name}`;
        const value = projects.get(key) ?? { group, days: new Set<string>(), ot: 0 };
        value.days.add(entry.date); value.ot += entry.otHours; projects.set(key, value);
      }
    }
    let pluto = 0, bsm = 0;
    for (const [key, value] of projects) {
      const name = key.split("|")[1];
      let slot: number;
      if (value.group === "BSM") { if (bsm >= 2) throw new Error(`${employee?.name ?? "A worker"} has more than 2 BSM projects in this period.`); slot = 4 + bsm++; }
      else if (value.group === "VRL") { vrlDays += value.days.size; continue; }
      else { if (pluto >= 4) throw new Error(`${employee?.name ?? "A worker"} has more than 4 Pluto projects in this period.`); slot = pluto++; }
      usedSlots.add(slot);
      const col = SLOT_COLS[slot];
      page.getCell(row, col).value = name;
      page.getCell(row, col + 1).value = value.days.size;
      page.getCell(row, col + 2).value = value.ot;
      // Bill amount needs the client rate — left blank for the user to fill.
    }
    const f = (formula: string) => ({ formula });
    page.getCell(`AC${row}`).value = f(`AI${row}*8`);
    page.getCell(`AD${row}`).value = f(`G${row}+K${row}+O${row}+S${row}+W${row}+AA${row}`);
    page.getCell(`AE${row}`).value = f(`AC${row}+AD${row}`);
    page.getCell(`AF${row}`).value = f(`F${row}+J${row}+N${row}+R${row}`);
    page.getCell(`AG${row}`).value = vrlDays;
    page.getCell(`AH${row}`).value = f(`V${row}+Z${row}`);
    page.getCell(`AI${row}`).value = f(`AF${row}+AG${row}+AH${row}`);
    page.getCell(`AJ${row}`).value = f(`H${row}+L${row}+P${row}+T${row}+X${row}+AB${row}`);
    page.getCell(`AL${row}`).value = f(`AJ${row}-AK${row}`);
    page.getCell(`AQ${row}`).value = f(`AN${row}+AO${row}+AP${row}`);
    for (let col = 2; col <= 43; col++) { const cell = page.getCell(row, col); cell.font = { name: "Arial", size: 10 }; cell.alignment = { vertical: "middle", wrapText: true }; }
    page.getRow(row).height = 42;
    page.getRow(row).hidden = false;
    row++;
  }
  // Show used project columns only, like the sample
  SLOT_COLS.forEach((col, i) => { for (let c = col; c < col + 4; c++) page.getColumn(c).hidden = !usedSlots.has(i); });
  const last = row - 1;
  page.getCell(`B${row}`).value = "TOTAL";
  page.getRow(row).hidden = false;
  const sumCols = ["F", "G", "H", "J", "K", "L", "N", "O", "P", "R", "S", "T", "V", "W", "X", "Z", "AA", "AB", "AC", "AD", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AN", "AO", "AP", "AQ"];
  for (const col of sumCols) page.getCell(`${col}${row}`).value = { formula: `SUM(${col}4:${col}${last})` };
  page.getCell(`AE${row}`).value = { formula: `AC${row}+AD${row}` };
  for (let col = 2; col <= 43; col++) page.getCell(row, col).font = { name: "Arial", size: 10, bold: true };
  workbook.calcProperties.fullCalcOnLoad = true;
  page.pageSetup.printArea = `B1:AQ${row}`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "combined_claim_sheet.xlsx"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
