import type { Worksheet } from "exceljs";

export function claimTemplateLayout(sheet: Worksheet) {
  const normalize = (text: string) => text.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const textOf = (cell: import("exceljs").Cell) => {
    const value = cell.value;
    if (typeof value === "string" || typeof value === "number") return String(value);
    if (value && typeof value === "object" && "richText" in value) return value.richText.map(part => part.text).join("");
    return "";
  };
  let headerRow = 0, codeCol = 0, nameCol = 0, categoryCol = 0, serialCol = 0;
  for (let r = 1; r <= Math.min(sheet.rowCount, 100); r++) {
    const cells = Array.from({ length: sheet.columnCount }, (_, i) => sheet.getCell(r, i + 1));
    const code = cells.find(c => ["STAFFCODE", "PFILENO", "PFILENUMBER"].includes(normalize(textOf(c))));
    const name = cells.find(c => ["NAME", "STAFFNAME", "WORKERNAME"].includes(normalize(textOf(c))));
    const category = cells.find(c => normalize(textOf(c)) === "CATEGORY");
    if (code && name && category) {
      headerRow = r; codeCol = Number(code.col); nameCol = Number(name.col); categoryCol = Number(category.col);
      serialCol = Number(cells.find(c => ["SN", "SNO"].includes(normalize(textOf(c))))?.col ?? 0);
      break;
    }
  }
  if (!headerRow) throw new Error("Template needs STAFF CODE, NAME and CATEGORY column headers.");
  const days = new Map<number, number>();
  for (let c = categoryCol + 1; c <= sheet.columnCount; c++) {
    const value = sheet.getCell(headerRow, c).value;
    const day = value instanceof Date ? value.getUTCDate() : typeof value === "number" ? value : /^\d{1,2}$/.test(String(value ?? "")) ? Number(value) : 0;
    if (day >= 1 && day <= 31) days.set(day, c);
  }
  const slots: { g: number; ot: number }[] = [];
  for (let r = headerRow + 1; r < sheet.rowCount; r++) {
    if (normalize(textOf(sheet.getCell(r, categoryCol))) === "GHRS" && ["OTHOURS", "OTHRS"].includes(normalize(textOf(sheet.getCell(r + 1, categoryCol))))) slots.push({ g: r, ot: r + 1 });
  }
  if (!days.size || !slots.length) throw new Error("Template needs numbered day columns and paired G-HRS / OT HOURS rows.");
  return { headerRow, codeCol, nameCol, categoryCol, serialCol, days, slots };
}

export function selectClaimTemplate(workbook: import("exceljs").Workbook) {
  const sheet = workbook.worksheets.find(s => s.name.toUpperCase() === "TEMPLATE") ?? (workbook.worksheets.length === 1 ? workbook.worksheets[0] : undefined);
  if (!sheet) throw new Error("Use a sheet named TEMPLATE, or upload a workbook containing only the blank sheet.");
  claimTemplateLayout(sheet);
  return sheet;
}