/**
 * Pre-export check of the generated claim workbook — the exact file the user downloads.
 * Code does every comparison (no AI): hours vs the approved data, formulas copied when rows
 * were added, total ranges, #REF!, headers (client / site / month), dates and serial numbers.
 * Only mechanical problems get a fix, and fixes are applied only when the user asks.
 */
import type { Workbook, Worksheet } from "exceljs";
import { claimTemplateLayout } from "@/core/claim-template";
import { shiftFormulaRows } from "@/core/claim-template-expand";
import { claimExpansion, reconcileClaimWorkbook, WEEKDAY, weekdayLike } from "@/lib/combined-claim-export";
import type { ClaimSheet, Employee } from "@/lib/types";

export interface CheckIssue { level: "error" | "warning"; sheet: string; cell?: string; message: string; fix?: CheckFix }
export interface CheckFix { sheet: string; cell: string; value: { formula: string } | string | number | Date | null }
export interface CheckResult { issues: CheckIssue[]; passed: string[]; fixable: number }
export interface CheckInput { sheets: ClaimSheet[]; employees: Employee[]; month: string; site?: string; knownSites?: string[] }

const norm = (s: unknown) => String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const compact = (f: string) => f.replace(/\s+/g, "").toUpperCase();
const monthLabel = (month: string) => { const [y, m] = month.split("-").map(Number); return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-SG", { month: "short", year: "numeric", timeZone: "UTC" }).toUpperCase(); };
const textOf = (v: unknown): string => {
  if (v == null) return "";
  if (typeof v === "object" && v && "richText" in v) return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
  if (typeof v === "object" && v && "result" in v) return String((v as { result?: unknown }).result ?? "");
  return String(v);
};
const RANGE = /(^|[^A-Za-z0-9_.!$'])(\$?)([A-Z]{1,3})(\$?)(\d+):(\$?)([A-Z]{1,3})(\$?)(\d+)/g;

function formulaOf(ws: Worksheet, r: number, c: number) {
  const cell = ws.getCell(r, c);
  return cell.formula ? String(cell.formula) : "";
}

function hasErrorValue(ws: Worksheet, r: number, c: number) {
  const v = ws.getCell(r, c).value as unknown;
  const f = formulaOf(ws, r, c);
  if (/#REF!/i.test(f)) return "#REF!";
  if (v && typeof v === "object" && "error" in (v as object)) return String((v as { error: unknown }).error);
  const res = v && typeof v === "object" && "result" in (v as object) ? (v as { result?: unknown }).result : undefined;
  if (res && typeof res === "object" && "error" in (res as object)) return String((res as { error: unknown }).error);
  return "";
}

function checkPage(ws: Worksheet, input: CheckInput, issues: CheckIssue[]) {
  let layout;
  try { layout = claimTemplateLayout(ws); } catch { return false; }
  const name = ws.name;
  const { slots } = layout;
  const cols = Math.max(ws.columnCount, ws.actualColumnCount);
  const first = slots[0]!, last = slots.at(-1)!;
  const inSlots = (r: number) => r >= first.g && r <= last.ot;
  const add = (level: CheckIssue["level"], message: string, cell?: string, fix?: Omit<CheckFix, "sheet">) =>
    issues.push({ level, sheet: name, cell, message, fix: fix ? { sheet: name, ...fix } : undefined });

  // 1. Broken references or error values anywhere on the page.
  for (let r = 1; r <= ws.rowCount; r++) for (let c = 1; c <= cols; c++) {
    const err = hasErrorValue(ws, r, c);
    if (err) add("error", `${err} in a formula — this cell cannot calculate`, ws.getCell(r, c).address);
  }

  // 2. Every worker's row must carry the same formula as the other workers (rows added for extra workers included).
  for (const kind of ["g", "ot"] as const) {
    for (let c = 1; c <= cols; c++) {
      const forms = slots.map((s) => formulaOf(ws, s[kind], c));
      if (forms.every((f) => !f)) continue;
      // Normalise every slot back to the first slot's rows. The reference is the most common pattern
      // among the template's own worker rows (ties → the earliest); added rows are copies of the last
      // template row, so letting them vote would let one bad row outvote a correct template.
      const base = forms.map((f, i) => (f ? compact(shiftFormulaRows(f, first[kind] - slots[i]![kind])) : ""));
      const originals = base.slice(0, claimExpansion.get(ws)?.templateSlots ?? base.length);
      const counts = new Map<string, number>();
      for (const b of originals) counts.set(b, (counts.get(b) ?? 0) + 1);
      let pattern = "", votes = 0;
      for (const b of originals) if ((counts.get(b) ?? 0) > votes) { pattern = b; votes = counts.get(b)!; }
      // A formula with no cell reference (=144/8) is a per-worker value typed as a sum, not a pattern.
      if (!pattern || !/\$?[A-Z]{1,3}\$?\d+/.test(pattern.replace(/"[^"]*"/g, ""))) continue;
      base.forEach((b, i) => {
        if (b === pattern) return;
        const r = slots[i]![kind];
        const cell = ws.getCell(r, c).address;
        const expected = shiftFormulaRows(pattern, r - first[kind]);
        const safe = !/#REF!/i.test(pattern);
        add("error", b ? `Formula differs from the other workers' rows (=${forms[i]} instead of =${expected})` : `Formula missing on this worker's row (others have =${expected})`, cell, safe ? { cell, value: { formula: expected } } : undefined);
      });
    }
  }

  // 3. Totals outside the worker rows that start at the first worker but stop early. Some templates
  //    sum a group on purpose (e.g. one company's workers), so this is a warning with no auto-fix.
  for (let r = 1; r <= ws.rowCount; r++) {
    if (inSlots(r)) continue;
    for (let c = 1; c <= cols; c++) {
      const f = formulaOf(ws, r, c);
      if (!f) continue;
      for (const m of f.matchAll(RANGE)) {
        const start = Number(m[5]), end = Number(m[9]);
        if (start < first.g || start > first.ot || end < first.g || end >= last.g) continue;
        add("warning", `Total =${f} stops at row ${end}; the workers run to row ${last.ot}. Check that leaving out the workers below is intended.`, ws.getCell(r, c).address);
        break;
      }
    }
  }

  // 4. Title rows: client, site and claim month.
  if (layout.headerRow >= 4) {
    if (!textOf(ws.getCell("A1").value).trim()) add("warning", "Client name is empty in the title — type it on the Upload step or link the site's project to a client", "A1");
    const site = (input.site ?? "").trim();
    const a2 = textOf(ws.getCell("A2").value).trim();
    if (!a2) add("error", "Site name is empty in the title", "A2", site ? { cell: "A2", value: site } : undefined);
    if (input.knownSites?.length && a2 && !input.knownSites.some((s) => norm(s) === norm(a2))) {
      add("warning", `Site "${a2}" is not in Projects & Sites — check the spelling, or add the site so it is tracked`, "A2");
    }
    const a3 = textOf(ws.getCell("A3").value).trim();
    const label = monthLabel(input.month);
    if (!a3.toUpperCase().endsWith(label)) add("error", `Title says "${a3 || "(empty)"}" but the claim month is ${label}`, "A3", { cell: "A3", value: `${a3.replace(/\s+[A-Z]{3}\s+\d{4}$/i, "") || "CLAIM FOR"} ${label}` });
  }

  // 5. Day columns: dated headers must be the claim month; days past month end must stay empty.
  const [y, m] = input.month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  for (const [day, c] of layout.days) {
    const cell = ws.getCell(layout.headerRow, c);
    const f = cell.formula ? String(cell.formula) : "";
    const dm = /DATE\(\s*(\d+)\s*,\s*(\d+)\s*,/i.exec(f);
    if (dm && (Number(dm[1]) !== y || Number(dm[2]) !== m)) add("error", `Day ${day} header is dated ${dm[2]}/${dm[1]}, not ${m}/${y}`, cell.address, { cell: cell.address, value: { formula: f.replace(/DATE\(\s*\d+\s*,\s*\d+\s*,/i, `DATE(${y},${m},`) } });
    const typed = cell.value instanceof Date ? cell.value : null;
    if (typed && (typed.getUTCFullYear() !== y || typed.getUTCMonth() + 1 !== m)) {
      add("error", day > daysInMonth ? `Day ${day} header shows ${typed.toISOString().slice(0, 10)}; ${monthLabel(input.month)} has no day ${day}` : `Day ${day} header shows ${typed.toISOString().slice(0, 10)}, not ${monthLabel(input.month)}`, cell.address, { cell: cell.address, value: day > daysInMonth ? null : new Date(Date.UTC(y, m - 1, day)) });
    }
    const wd = ws.getCell(layout.headerRow + 1, c);
    const wdText = typeof wd.value === "string" ? wd.value.trim() : "";
    if (wdText && WEEKDAY.test(wdText)) {
      const want = day <= daysInMonth ? weekdayLike(wdText, y, m, day) : "";
      if (wdText !== want) add("error", `Weekday under day ${day} says ${wdText}, should be ${want || "blank"}`, wd.address, { cell: wd.address, value: want || null });
    }
    if (day > daysInMonth) for (const s of slots) for (const r of [s.g, s.ot]) {
      if (textOf(ws.getCell(r, c).value).trim()) add("error", `Hours on day ${day}, which does not exist in ${monthLabel(input.month)}`, ws.getCell(r, c).address);
    }
  }

  // 6. Workers: each listed once, identified, numbered in order.
  const seen = new Map<string, string>();
  let n = 0;
  for (const s of slots) {
    const code = textOf(ws.getCell(s.g, layout.codeCol).value).trim();
    const nameText = textOf(ws.getCell(s.g, layout.nameCol).value).trim();
    const hasHours = [...layout.days.values()].some((c) => Number(textOf(ws.getCell(s.g, c).value)) || Number(textOf(ws.getCell(s.ot, c).value)));
    if (!code && !nameText) { if (hasHours) add("error", "Hours entered on a row with no worker", ws.getCell(s.g, layout.codeCol).address); continue; }
    n++;
    const key = norm(code) || norm(nameText);
    if (seen.has(key)) add("error", `${code || nameText} is listed twice (also at ${seen.get(key)})`, ws.getCell(s.g, layout.codeCol).address);
    else seen.set(key, ws.getCell(s.g, layout.codeCol).address);
    if (!code) add("warning", `${nameText} has no staff code`, ws.getCell(s.g, layout.codeCol).address);
    if (layout.serialCol) {
      const cell = ws.getCell(s.g, layout.serialCol);
      if (Number(textOf(cell.value)) !== n) add("warning", `S/N is ${textOf(cell.value) || "empty"}, expected ${n}`, cell.address, { cell: cell.address, value: n });
    }
  }
  return true;
}

export function checkClaimWorkbook(workbook: Workbook, input: CheckInput): CheckResult {
  const issues: CheckIssue[] = [];
  // Hidden sheets are working copies the client never sees.
  const pages = workbook.worksheets.filter((ws) => ws.state === "visible" && checkPage(ws, input, issues));
  // 7. Every approved hour is in the sheet, nothing extra (cell-by-cell against the reviewed data).
  for (const r of reconcileClaimWorkbook(workbook, input.sheets, input.employees, input.month)) {
    issues.push({ level: "error", sheet: "all", message: `${r.worker}${r.date ? ` ${r.date}` : ""}: ${r.kind} (expected ${r.expected}, sheet has ${r.actual})` });
  }
  const has = (re: RegExp) => issues.some((i) => re.test(i.message));
  const passed = [
    [!has(/expected .*sheet has|Worker not in sheet|Unexpected worker/), "Every reviewed hour is in the sheet, nothing extra"],
    [!has(/Formula (differs|missing)/), "Formulas are the same on every worker's row, including added rows"],
    [!has(/stops at row/), "Totals cover every worker"],
    [!has(/#REF!|cannot calculate/), "No broken formulas"],
    [!has(/Site name|Title says|header is dated|header shows|Weekday under/), "Title (site, month), dates and weekdays are right"],
    [!has(/listed twice|no worker|S\/N/), "Each worker listed once and numbered in order"],
  ].filter(([ok]) => ok).map(([, t]) => `${t} (${pages.length} sheet${pages.length === 1 ? "" : "s"})`) as string[];
  return { issues, passed, fixable: issues.filter((i) => i.fix).length };
}

export function applyClaimFixes(workbook: Workbook, issues: CheckIssue[]) {
  let applied = 0;
  for (const { fix } of issues) {
    if (!fix) continue;
    const ws = workbook.getWorksheet(fix.sheet);
    if (!ws) continue;
    ws.getCell(fix.cell).value = fix.value as never;
    applied++;
  }
  workbook.calcProperties.fullCalcOnLoad = true;
  return applied;
}
