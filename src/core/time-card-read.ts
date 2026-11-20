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

/**
 * One header value from two readers; when they differ, a third reader that agrees with one
 * side settles it (two of three). Unsettled differences stay flagged for review.
 */
function pick<T>(a: T | undefined, b: T | undefined, same: (x: T, y: T) => boolean, judge?: T) {
  if (a === undefined && b === undefined) return { value: undefined, agree: true, settled: false };
  if (a !== undefined && b !== undefined && same(a, b)) return { value: a, agree: true, settled: false };
  if (judge !== undefined) {
    if (a !== undefined && same(judge, a)) return { value: a, agree: true, settled: true };
    if (b !== undefined && same(judge, b)) return { value: b, agree: true, settled: true };
  }
  return { value: a ?? b, agree: false, settled: false };
}

function matchAudit(card: CardRead, primary: CardRead[], audit: CardRead[]) {
  if (primary.length === 1 && audit.length === 1) return audit[0];
  const byCode = card.employeeCode && audit.filter(a => norm(a.employeeCode) === norm(card.employeeCode));
  if (byCode && byCode.length === 1) return byCode[0];
  const byIndex = audit.filter(a => a.cardIndex === card.cardIndex);
  return byIndex.length === 1 ? byIndex[0] : undefined;
}

const HEADER_FIELDS = ["siteName", "workerName", "employeeCode", "fin"] as const;
export type DisputedField = (typeof HEADER_FIELDS)[number] | "year" | "month";
export interface CardDispute { cardIndex: number; workerName?: string; employeeCode?: string; days: number[]; fields: DisputedField[] }

/**
 * Exactly what two readers could not agree on, per card: dates read differently (or work vs off)
 * and card details both read but differently. Nothing else goes to the paid tie-breaker.
 */
export function cardDisputes(primary: CardRead[], audit: CardRead[]): CardDispute[] {
  return primary.flatMap((card) => {
    const other = matchAudit(card, primary, audit);
    if (!other) return [];
    const days: number[] = [];
    for (let day = 1; day <= 31; day++) {
      const p = card.days.find(d => d.day === day), a = other.days.find(d => d.day === day);
      if (!worked(p) && !worked(a)) continue;
      if (worked(p) && worked(a) && sameDay(p!, a!)) continue;
      days.push(day);
    }
    const fields: DisputedField[] = HEADER_FIELDS.filter(f => card[f] && other[f] && norm(card[f]) !== norm(other[f]));
    if (card.year && other.year && card.year !== other.year) fields.push("year");
    if (card.month && other.month && card.month !== other.month) fields.push("month");
    return days.length || fields.length ? [{ cardIndex: card.cardIndex, workerName: card.workerName ?? other.workerName, employeeCode: card.employeeCode ?? other.employeeCode, days, fields }] : [];
  });
}

/** A short question about only the disputed items, so the tie-breaker's answer stays small. */
export function disputeInstruction(disputes: CardDispute[]): string {
  const asks = disputes.map(d => {
    const who = [d.workerName, d.employeeCode].filter(Boolean).join(", ") || "unnamed worker";
    const parts = [d.days.length ? `dates ${d.days.join(", ")}` : "", d.fields.length ? `header fields ${d.fields.join(", ")}` : ""].filter(Boolean).join(" and ");
    return `cardIndex ${d.cardIndex} (${who}): ${parts}`;
  });
  return `${TIME_CARD_READ_INSTRUCTION}\n\nTWO READERS ALREADY READ THIS CARD AND DISAGREED ONLY ON THE ITEMS BELOW. ` +
    `Re-read ONLY these items very carefully from the image and return nothing else:\n- ${asks.join("\n- ")}\n` +
    `Use exactly these cardIndex values. In "days" include only the listed dates (a listed date that is off or empty: {"day":N,"off":true}). ` +
    `Include a header field only if it is listed. Return JSON {"cards":[{"cardIndex":1,"days":[...]}]}.`;
}

/** Merge two independent readings; agreement = high confidence, disagreement = flagged. */
export function mergeCardReads(primary: CardRead[], audit: CardRead[] | null, names: { primary: string; audit?: string; third?: string } = { primary: "gemini", audit: "openai" }, third?: CardRead[] | null): ReadRow[] {
  const rows: ReadRow[] = [];
  const matched = new Set<CardRead>();
  for (const card of primary) {
    const other = audit ? matchAudit(card, primary, audit) : undefined;
    if (other) matched.add(other);
    // Optional tie-breaker: a third independent read settles days the first two disagree on.
    const judge = other && third?.length ? matchAudit(card, primary, third) : undefined;
    const sameText = (x: string, y: string) => norm(x) === norm(y);
    const sameNum = (x: number, y: number) => x === y;
    const header = HEADER_FIELDS.map(field => [field, pick(card[field], other?.[field], sameText, judge?.[field])] as const);
    const headerOf = Object.fromEntries(header) as Record<(typeof header)[number][0], ReturnType<typeof pick<string>>>;
    const site = headerOf.siteName;
    const year = other ? pick(card.year, other.year, sameNum, judge?.year) : { value: card.year, agree: false, settled: false };
    const month = other ? pick(card.month, other.month, sameNum, judge?.month) : { value: card.month, agree: false, settled: false };
    const settled = [...header.filter(([, v]) => v.settled).map(([f]) => f), ...(year.settled ? ["year"] : []), ...(month.settled ? ["month"] : [])];
    let y = year.value, m = month.value;
    // An unreadable month must not silently drop a worker: borrow it only when every other card agrees.
    const borrowed = !y || !m;
    if (borrowed) {
      const periods = new Set(primary.filter(c => c.year && c.month).map(c => `${c.year}-${c.month}`));
      const [by, bm] = periods.size === 1 ? [...periods][0].split("-").map(Number) : [];
      if (!by) continue;
      y = by; m = bm;
    }
    const periodDoubt = borrowed || (!!other && (!year.agree || !month.agree));
    const headerConflicts = other ? header.filter(([, v]) => !v.agree).map(([f]) => f) : [];
    const max = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
    const identity = {
      workerName: headerOf.workerName.value,
      employeeCode: headerOf.employeeCode.value,
      fin: headerOf.fin.value,
      siteName: site.value,
    };
    const settledNote = settled.length ? `Card details settled by ${names.third ?? "third"} reader: ${settled.join(", ")}` : undefined;
    for (let day = 1; day <= max; day++) {
      const p = card.days.find(d => d.day === day);
      const a = other?.days.find(d => d.day === day);
      if (!worked(p) && !worked(a)) continue;
      let base = worked(p) ? p! : a!;
      const t = judge?.days.find(d => d.day === day);
      const tName = names.third ?? "third";
      let confidence: number; let verifiedBy: string; let remarks: string | undefined; let suggestion: ReadRow["suggestion"];
      if (!other) { confidence = 0.8; verifiedBy = names.primary; }
      else if (worked(p) && worked(a) && sameDay(p!, a!)) { confidence = 0.97; verifiedBy = `${names.primary}+${names.audit}`; }
      else if (worked(p) && worked(a) && worked(t) && sameDay(t!, p!)) {
        confidence = 0.95; verifiedBy = `${names.primary}+${tName}`; remarks = `Second reader: ${describe(a!)}`;
      } else if (worked(p) && worked(a) && worked(t) && sameDay(t!, a!)) {
        base = a!; confidence = 0.95; verifiedBy = `${names.audit}+${tName}`; remarks = `First reader: ${describe(p!)}`;
      } else if (worked(p) && worked(a)) {
        confidence = 0.45; verifiedBy = "conflict";
        suggestion = { checkIn: a!.start, checkOut: a!.end };
        remarks = [`Second reader: ${describe(a!)}`, judge && (worked(t) ? `Third reader: ${describe(t!)}` : "Third reader saw this day as off")].filter(Boolean).join(" · ");
      } else if (worked(t) && sameDay(t!, base)) {
        confidence = 0.9; verifiedBy = `${worked(p) ? names.primary : names.audit}+${tName}`;
        remarks = worked(p) ? "Second reader saw this day as off" : "First reader saw this day as off";
      } else {
        confidence = 0.4; verifiedBy = worked(p) ? names.primary : names.audit ?? "audit";
        remarks = [worked(p) ? "Second reader saw this day as off" : "Only the second reader saw work on this day", judge && (worked(t) ? `Third reader: ${describe(t!)}` : "Third reader saw this day as off")].filter(Boolean).join(" · ");
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
        remarks = [remarks, `Readers disagree on card details: ${headerConflicts.map(field => `${field}: ${card[field] || "unreadable"} / ${other[field] || "unreadable"}${judge ? ` / ${judge[field] || "unreadable"}` : ""}`).join("; ")} — verify the original`].filter(Boolean).join(" · ");
      }
      if (settledNote) remarks = [remarks, settledNote].filter(Boolean).join(" · ");
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
