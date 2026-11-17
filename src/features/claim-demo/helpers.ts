import type { DayEntry, Worker } from "./types";

export const BREAK_HOURS = 1;
const toH = (t: string) => { const [h, m] = t.split(":").map(Number); return h + m / 60; };

/** True when Out − In − break equals G + OT (non-work rows always pass). */
export function rowMatches(d: DayEntry): boolean {
  if (d.status !== "work" || !d.inTime || !d.outTime) return true;
  return Math.abs(toH(d.outTime) - toH(d.inTime) - BREAK_HOURS - ((d.g ?? 0) + (d.ot ?? 0))) < 0.01;
}
export const mismatchCount = (w: Worker) => w.days.filter((d) => !rowMatches(d)).length;
export const problemCount = (w: Worker) => mismatchCount(w) + w.flags.length;

export function workerTotals(w: Worker) {
  const work = w.days.filter((d) => d.status === "work");
  const g = work.reduce((s, d) => s + (d.g ?? 0), 0);
  const ot = work.reduce((s, d) => s + (d.ot ?? 0), 0);
  return { days: work.filter((d) => d.g != null && d.g > 0).length, g, ot, total: g + ot };
}
export function batchTotals(ws: Worker[]) {
  return ws.reduce((a, w) => { const t = workerTotals(w); return { staff: a.staff + 1, g: a.g + t.g, ot: a.ot + t.ot, total: a.total + t.total }; }, { staff: 0, g: 0, ot: 0, total: 0 });
}
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const weekday = (y: number, m: number, d: number) => WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
export const isSunday = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 0;
export const surname = (name: string) => name.split(" ").slice(-1)[0];
export const monthLabel = (ym: string) => { const [y, m] = ym.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }); };
export const monthShort = (ym: string) => { const [y, m] = ym.split("-").map(Number); return `${new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "short", timeZone: "UTC" }).toUpperCase()} ${y}`; };

/** Plug points for later. */
export async function readCards(_files: File[]): Promise<Worker[]> { throw new Error("Real OCR not connected"); }
export async function exportExcel(_ws: Worker[]): Promise<Blob> { throw new Error("Excel export not connected"); }
