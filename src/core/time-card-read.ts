import { spanFromTimes, splitDutyHours } from "./work-hours";

/**
 * Whole-card time-card reading: each AI returns every printed day 1–31 for each
 * physical card. Two independent reads are merged day by day.
 */
export const TIME_CARD_READ_INSTRUCTION =
  "This is a scanned monthly worker time card, usually a Pentex \"WORK RECORD CARD\" (工友记工卡). A page may hold one or more physical cards; " +
  "number each physical card in reading order with cardIndex starting at 1 (front and back of the same worker are ONE card). " +
  "HEADER: year is the handwritten value beside 年/year, month beside 月份/month (abbreviated English months like Oct = 10). " +
  "siteName is the handwritten value beside the printed 工场/Site label in the header box. workerName is beside 姓名/Name. " +
  "The Address/地址 line usually holds the staff P-file code (e.g. PC-34) — return it as employeeCode, never as siteName. fin is beside Identity Card No/身份证号码. " +
  "DAILY TABLE: read EVERY date row 1 to 31 (left half 1–15, right half 16–31). On these cards the columns are used as: " +
  "the 工数/Qty column = start time (e.g. 0800), the 工场/Site No. column = end time (e.g. 2000), the 支银/Amount column = hours written as normal+OT " +
  "(\"8+3\" means 8 normal and 3 OT; \"8\" means 8 normal and 0 OT), followed by a site code or a ditto mark (u / n / 〃 meaning same as above). " +
  "If a card instead has explicit In/Out columns, use those for start/end. A circled date is a rest day but may still have work written. " +
  "A row marked OFF, crossed out or left empty is off. " +
  'Return JSON {"cards":[{"cardIndex":1,"year":2026,"month":10,"siteName":"...","workerName":"...","employeeCode":"...","fin":"...","days":[{"day":1,"start":"08:00","end":"20:00","normal":8,"ot":3,"off":false}]}]}. ' +
  "Give exactly one days entry per date printed on the card (1..31). For off rows set off:true and omit times/hours. Use 24-hour HH:MM. " +
  "The example year/month/values are format examples, not defaults. Never guess: omit any value that is truly unreadable.";

export interface CardDay { day: number; start?: string; end?: string; normal?: number; ot?: number; off?: boolean }
export interface CardRead {
  cardIndex: number; year?: number; month?: number;
  siteName?: string; workerName?: string; employeeCode?: string; fin?: string;
  days: CardDay[];
}

export interface ReadRow {
  cardIndex: number; date: string;
  checkIn?: string; checkOut?: string; normalHours?: number; otHours?: number;
  workerName?: string; employeeCode?: string; fin?: string; siteName?: string;
  confidence: number; verifiedBy: string; remarks?: string;
  suggestion?: { checkIn?: string; checkOut?: string };
}

const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const norm = (value?: string) => (value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const num = (value: unknown) => {
  const n = typeof value === "string" ? Number(value.trim()) : value;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 24 ? n : undefined;
};
function time(value: unknown) {
  const raw = text(value)?.replace(/\s/g, "");
  if (!raw) return undefined;
  const m = /^(\d{1,2}):?(\d{2})$/.exec(raw);
  if (!m) return undefined;
  const h = Number(m[1]), min = Number(m[2]);
  return h <= 24 && min < 60 ? `${String(h % 24).padStart(2, "0")}:${m[2]}` : undefined;
}

export function parseCardReads(value: unknown): CardRead[] {
  if (!value || typeof value !== "object") return [];
  const list = Array.isArray(value) ? value
    : Array.isArray((value as { cards?: unknown }).cards) ? (value as { cards: unknown[] }).cards
    : Array.isArray((value as { days?: unknown }).days) ? [value] : [];
  return list.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const year = Number(raw.year), month = Number(raw.month);
    const idx = Number(raw.cardIndex);
    const employeeCode = text(raw.employeeCode), workerName = text(raw.workerName), fin = text(raw.fin);
    const site = text(raw.siteName);
    const siteIsIdentity = site && [employeeCode, workerName, fin].some(v => v && norm(v) === norm(site));
    const days = (Array.isArray(raw.days) ? raw.days : []).flatMap(d => {
      if (!d || typeof d !== "object") return [];
      const r = d as Record<string, unknown>;
      const day = Number(r.day);
      if (!Number.isInteger(day) || day < 1 || day > 31) return [];
      return [{ day, start: time(r.start), end: time(r.end), normal: num(r.normal), ot: num(r.ot), off: r.off === true }];
    });
    return [{
      cardIndex: Number.isInteger(idx) && idx >= 1 ? idx : index + 1,
      year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : undefined,
      month: Number.isInteger(month) && month >= 1 && month <= 12 ? month : undefined,
      siteName: siteIsIdentity ? undefined : site, workerName, employeeCode, fin, days,
    }];
  });
}

const worked = (d?: CardDay) => !!d && !d.off && !!(d.start || d.end || (d.normal ?? 0) > 0 || (d.ot ?? 0) > 0);
const sameDay = (a: CardDay, b: CardDay) => a.start === b.start && a.end === b.end && (a.normal ?? 0) === (b.normal ?? 0) && (a.ot ?? 0) === (b.ot ?? 0);
const describe = (d: CardDay) => `${d.start ?? "?"}–${d.end ?? "?"} (${d.normal ?? "?"}+${d.ot ?? 0})`;

function pick<T>(a: T | undefined, b: T | undefined, same: (x: T, y: T) => boolean) {
  if (a === undefined) return { value: b, agree: b === undefined };
  if (b === undefined) return { value: a, agree: false };
  return { value: a, agree: same(a, b) };
}

function matchAudit(card: CardRead, primary: CardRead[], audit: CardRead[]) {
  if (primary.length === 1 && audit.length === 1) return audit[0];
  const byCode = card.employeeCode && audit.filter(a => norm(a.employeeCode) === norm(card.employeeCode));
  if (byCode && byCode.length === 1) return byCode[0];
  const byIndex = audit.filter(a => a.cardIndex === card.cardIndex);
  return byIndex.length === 1 ? byIndex[0] : undefined;
}

/** Merge two independent readings; agreement = high confidence, disagreement = flagged. */
export function mergeCardReads(primary: CardRead[], audit: CardRead[] | null, names: { primary: string; audit?: string } = { primary: "gemini", audit: "openai" }): ReadRow[] {
  const rows: ReadRow[] = [];
  const matched = new Set<CardRead>();
  for (const card of primary) {
    const other = audit ? matchAudit(card, primary, audit) : undefined;
    if (other) matched.add(other);
    const site = pick(card.siteName, other?.siteName, (x, y) => norm(x) === norm(y));
    const year = pick(card.year, other?.year, (x, y) => x === y);
    const month = pick(card.month, other?.month, (x, y) => x === y);
    const y = year.value, m = month.value;
    if (!y || !m) continue;
    const periodDoubt = !!other && (!year.agree || !month.agree);
    const headerConflicts = other ? (["siteName", "workerName", "employeeCode", "fin"] as const).filter(field => norm(card[field]) !== norm(other[field])) : [];
    const max = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const identity = {
      workerName: card.workerName ?? other?.workerName,
      employeeCode: card.employeeCode ?? other?.employeeCode,
      fin: card.fin ?? other?.fin,
      siteName: site.value,
    };
    for (let day = 1; day <= max; day++) {
      const p = card.days.find(d => d.day === day);
      const a = other?.days.find(d => d.day === day);
      if (!worked(p) && !worked(a)) continue;
      const base = worked(p) ? p! : a!;
      let confidence: number; let verifiedBy: string; let remarks: string | undefined; let suggestion: ReadRow["suggestion"];
      if (!other) { confidence = 0.8; verifiedBy = names.primary; }
      else if (worked(p) && worked(a) && sameDay(p!, a!)) { confidence = 0.97; verifiedBy = `${names.primary}+${names.audit}`; }
      else if (worked(p) && worked(a)) {
        confidence = 0.45; verifiedBy = "conflict";
        suggestion = { checkIn: a!.start, checkOut: a!.end };
        remarks = `Second reader: ${describe(a!)}`;
      } else {
        confidence = 0.4; verifiedBy = worked(p) ? names.primary : names.audit ?? "audit";
        remarks = worked(p) ? "Second reader saw this day as off" : "Only the second reader saw work on this day";
      }
      // The written hours must agree with the start/end times under the 9h duty rule.
      const span = spanFromTimes(base.start, base.end);
      if (span !== null && base.normal !== undefined) {
        const calc = splitDutyHours(span);
        if (calc.normalHours !== base.normal || calc.otHours !== (base.ot ?? 0)) {
          confidence = Math.min(confidence, 0.6);
          remarks = [remarks, `Written ${base.normal}+${base.ot ?? 0} differs from times (${calc.normalHours}+${calc.otHours})`].filter(Boolean).join(" · ");
        }
      }
      if (periodDoubt) { confidence = Math.min(confidence, 0.5); remarks = [remarks, "Readers disagree on month/year — check Claim Month"].filter(Boolean).join(" · "); }
      if (headerConflicts.length && other) {
        confidence = Math.min(confidence, 0.5);
        remarks = [remarks, `Readers disagree on card details: ${headerConflicts.map(field => `${field}: ${card[field] || "unreadable"} / ${other[field] || "unreadable"}`).join("; ")} — verify the original`].filter(Boolean).join(" · ");
      }
      const fallback = span === null ? undefined : splitDutyHours(span);
      rows.push({
        cardIndex: card.cardIndex,
        date: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        checkIn: base.start, checkOut: base.end,
        normalHours: base.normal ?? fallback?.normalHours,
        otHours: base.normal !== undefined ? (base.ot ?? 0) : fallback?.otHours,
        ...identity, confidence, verifiedBy, remarks, suggestion,
      });
    }
  }
  // An entire worker seen only by the second reader must not disappear.
  const remaining = audit?.filter(card => !matched.has(card)) ?? [];
  let nextIndex = Math.max(0, ...primary.map(card => card.cardIndex));
  for (const card of remaining) {
    const additional = mergeCardReads([{ ...card, cardIndex: ++nextIndex }], null, { primary: names.audit ?? "audit" });
    rows.push(...additional.map(row => ({ ...row, confidence: Math.min(row.confidence, 0.4), remarks: [row.remarks, "Only the second reader found this worker — verify the original card"].filter(Boolean).join(" · ") })));
  }
  return rows;
}

/** Move entries to the confirmed claim month, keeping the day of month. */
export function redateToMonth<T extends { date: string }>(entries: T[], month: string): T[] {
  const [y, m] = month.split("-").map(Number);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Choose a valid claim month");
  const max = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const seen = new Set<number>();
  return entries.map(entry => {
    const day = Number(entry.date.slice(8, 10));
    if (!Number.isInteger(day) || day < 1 || day > max) throw new Error(`Date ${entry.date} cannot fit in ${month}. Check Claim Month; no dates have been removed.`);
    if (seen.has(day)) throw new Error(`Duplicate day ${day}. Review the source instead of dropping or adding hours.`);
    seen.add(day);
    return { ...entry, date: `${month}-${String(day).padStart(2, "0")}` };
  });
}
