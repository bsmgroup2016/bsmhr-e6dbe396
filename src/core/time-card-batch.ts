import type { TimeCardIdentity } from "./time-card-matching";

export interface BatchCardRow extends TimeCardIdentity {
  date: string;
  cardIndex?: number;
  checkIn?: string;
  checkOut?: string;
  confidence?: number;
  suggestion?: { checkIn?: string; checkOut?: string };
}

const normalized = (value?: string) => (value ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
export function cardRowKey(row: BatchCardRow) {
  return JSON.stringify([row.cardIndex ?? 1, normalized(row.employeeCode), normalized(row.fin), normalized(row.workerName), normalized(row.siteName), normalized(row.projectName), row.date]);
}

/** No date-only grouping: separate people, locations and claim months. */
export function groupTimeCardRows<T extends BatchCardRow>(rows: T[]): { identity: TimeCardIdentity; entries: T[] }[] {
  const groups = new Map<string, { identity: TimeCardIdentity; entries: T[] }>();
  for (const row of rows) {
    const key = JSON.stringify([row.cardIndex ?? 1, normalized(row.employeeCode), normalized(row.fin), normalized(row.workerName), normalized(row.siteName), normalized(row.projectName), row.date.slice(0, 7)]);
    const group = groups.get(key) ?? { identity: { workerName: row.workerName, employeeCode: row.employeeCode, fin: row.fin, siteName: row.siteName, projectName: row.projectName }, entries: [] };
    if (group.entries.some(entry => entry.date === row.date)) throw new Error(`Duplicate day ${row.date} for ${row.employeeCode || row.workerName || "an unidentified card"}. Review the source instead of combining hours.`);
    group.entries.push(row);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Runs only from the file-upload handler; pdf-lib is pure JS, not a PDF renderer. */
export async function splitTimeCardFile(file: File): Promise<File[]> {
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return [file];
  const { PDFDocument } = await import("pdf-lib");
  const source = await PDFDocument.load(await file.arrayBuffer());
  if (source.getPageCount() === 0) throw new Error("The PDF has no pages");
  if (source.getPageCount() === 1) return [file];
  const pages: File[] = [];
  for (let index = 0; index < source.getPageCount(); index++) {
    const output = await PDFDocument.create();
    const [page] = await output.copyPages(source, [index]);
    if (!page) throw new Error(`Could not read PDF page ${index + 1}`);
    output.addPage(page);
    const bytes = new Uint8Array(await output.save());
    pages.push(new File([bytes], `${file.name.replace(/\.pdf$/i, "")}-page-${index + 1}.pdf`, { type: "application/pdf" }));
  }
  return pages;
}