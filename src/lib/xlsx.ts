export type ExportSheet = {
  name: string;
  rows: Record<string, unknown>[];
};

function sanitizeSheetName(name: string) {
  return name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet1";
}

export function timestampedName(base: string, ext: string) {
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10);
  return `${base}_${stamp}.${ext}`;
}

export async function exportSheets(sheets: ExportSheet[], filename: string) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows.length ? sheet.rows : [{}]);
    const widths = Object.keys(sheet.rows[0] ?? {}).map((key) => {
      const longest = sheet.rows.reduce((max, row) => {
        const value = row[key];
        return Math.max(max, value == null ? 0 : String(value).length);
      }, key.length);
      return { wch: Math.min(Math.max(longest + 2, 10), 40) };
    });
    if (widths.length) worksheet["!cols"] = widths;
    XLSX.utils.book_append_sheet(workbook, worksheet, sanitizeSheetName(sheet.name));
  }
  XLSX.writeFile(workbook, filename);
}

export async function exportRows(
  rows: Record<string, unknown>[],
  filename: string,
  sheetName = "Sheet1",
) {
  await exportSheets([{ name: sheetName, rows }], filename);
}

export async function exportCsv(rows: Record<string, unknown>[], filename: string) {
  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function readSpreadsheet(file: File): Promise<Record<string, string>[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const first = workbook.SheetNames[0];
  if (!first) return [];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[first], {
    defval: "",
    raw: false,
  });
  return raw.map((row) => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key.trim().toLowerCase()] = value == null ? "" : String(value).trim();
    }
    return normalized;
  });
}

export type ImportColumn = {
  key: string;
  label: string;
  required?: boolean;
  example?: string;
};

export async function downloadTemplate(columns: ImportColumn[], filename: string, sheetName = "Template") {
  const sample: Record<string, unknown> = {};
  for (const column of columns) sample[column.label] = column.example ?? "";
  await exportSheets([{ name: sheetName, rows: [sample] }], filename);
}

export function pick(row: Record<string, string>, column: ImportColumn) {
  return row[column.label.trim().toLowerCase()] ?? "";
}