import type { BatchCardRow } from "./time-card-batch";

export const TIME_CARD_HEADER_INSTRUCTION =
  "Read each physical card header independently, in reading order. The handwritten value immediately beside the printed Site / 工场 label is siteName. " +
  "Never use Address / 地址, Name / 姓名, Identity Card No / 身份证号码, staff/P-file code or daily Site No columns as the header Site. " +
  "On these work record cards a staff/P-file code may be handwritten in Address; keep it as employeeCode, never siteName. " +
  "Read the handwritten year beside year / 年 and month beside month / 月份, including abbreviated English months. " +
  "Do not derive month/year from worker codes, card numbering, daily columns or today's date. " +
  "Keep workerName, employeeCode, fin and siteName separate; omit uncertain fields rather than guessing. " +
  "Only read projectName if a project is explicitly labelled; never treat a worker name or code as a project.";

interface CardHeader {
  cardIndex: number;
  siteName?: string;
  workerName?: string;
  employeeCode?: string;
  fin?: string;
  year?: number;
  month?: number;
}

const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const normalized = (value?: string) => (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export function parseCardHeaders(value: unknown): CardHeader[] {
  if (!value || typeof value !== "object") return [];
  const cards = (value as { cards?: unknown }).cards;
  if (!Array.isArray(cards)) return [];
  return cards.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    if (!Number.isInteger(raw.cardIndex) || Number(raw.cardIndex) < 1) return [];
    const employeeCode = text(raw.employeeCode);
    const workerName = text(raw.workerName);
    const fin = text(raw.fin);
    const site = text(raw.siteName);
    const isWorkerIdentity = site && [employeeCode, workerName, fin].some(identity => identity && normalized(identity) === normalized(site));
    const year = Number(raw.year);
    const month = Number(raw.month);
    return [{ cardIndex: Number(raw.cardIndex), siteName: isWorkerIdentity ? undefined : site, employeeCode, workerName, fin,
      year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : undefined,
      month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : undefined }];
  });
}

/** Apply only a unique matching physical header, never another worker's site. */
export function applyCardHeaders<T extends BatchCardRow>(rows: T[], headers: CardHeader[]): T[] {
  return rows.map(row => {
    const matches = headers.filter(header => header.cardIndex === (row.cardIndex ?? 1));
    const header = matches.length === 1 ? matches[0] : undefined;
    if (!header) return row;
    let date = row.date;
    if (header.year && header.month) {
      const day = Number(row.date.slice(8, 10));
      const max = new Date(Date.UTC(header.year, header.month, 0)).getUTCDate();
      if (day < 1 || day > max) return { ...row, siteName: header.siteName, confidence: 0.3 };
      date = `${header.year}-${String(header.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return { ...row, date, siteName: header.siteName, workerName: header.workerName ?? row.workerName,
      employeeCode: header.employeeCode ?? row.employeeCode, fin: header.fin ?? row.fin };
  });
}