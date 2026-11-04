import type { CellValue, Worksheet, Workbook } from "exceljs";

export function editableClaimCell(sheet: Worksheet, address: string) {
  const cell = sheet.getCell(address);
  return !(cell.isMerged && cell.master.address !== cell.address) && !cell.formula;
}

export function claimCellValue(text: string): CellValue {
  if (text === "") return null;
  // Codes and leading-zero identifiers must remain text, not numbers.
  return /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text) ? Number(text) : text;
}

export function setClaimCell(sheet: Worksheet, address: string, text: string) {
  if (!editableClaimCell(sheet, address)) return false;
  sheet.getCell(address).value = claimCellValue(text);
  return true;
}

export function clearClaimFormulaResults(workbook: Workbook) {
  workbook.worksheets.forEach(sheet => sheet.eachRow(row => row.eachCell(cell => {
    const value = cell.value;
    if (value && typeof value === "object" && ("formula" in value || "sharedFormula" in value)) {
      const { result: _result, ...formula } = value;
      cell.value = formula as CellValue;
    }
  })));
  workbook.calcProperties.fullCalcOnLoad = true;
}