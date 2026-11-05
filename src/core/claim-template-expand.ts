import type { Worksheet } from "exceljs";

const REF = /(?<![A-Za-z0-9_.$])(\$?)([A-Z]{1,3})(\$?)(\d+)(?::(\$?)([A-Z]{1,3})(\$?)(\d+))?(?![A-Za-z0-9_(])/g;

/** Moves relative row references in a formula by `offset` (used when copying a worker slot). */
export function shiftFormulaRows(formula: string, offset: number) {
  return formula.replace(REF, (_m, c1, col1, a1, r1, c2, col2, a2, r2) => {
    const one = `${c1}${col1}${a1}${a1 ? r1 : Number(r1) + offset}`;
    return col2 ? `${one}:${c2}${col2}${a2}${a2 ? r2 : Number(r2) + offset}` : one;
  });
}

/**
 * Adjusts a formula after `delta` rows were inserted at `insertAt`:
 * references at/after the insert point move down, and ranges that end on the
 * last worker row (insertAt - 1) grow to include the new workers.
 */
export function adjustFormulaForInsert(formula: string, insertAt: number, delta: number) {
  const move = (r: number) => (r >= insertAt ? r + delta : r);
  return formula.replace(REF, (_m, c1, col1, a1, r1, c2, col2, a2, r2) => {
    const s = Number(r1);
    if (!col2) return `${c1}${col1}${a1}${move(s)}`;
    const e = Number(r2);
    const end = e === insertAt - 1 && s < insertAt ? e + delta : move(e);
    return `${c1}${col1}${a1}${move(s)}:${c2}${col2}${a2}${end}`;
  });
}

type Snap = { col: number; value: unknown; style: unknown };
const parse = (range: string) => {
  const m = range.replace(/\$/g, "").match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
  if (!m) return null;
  return { c1: m[1], r1: Number(m[2]), c2: m[3] ?? m[1], r2: Number(m[4] ?? m[2]) };
};

function snapRow(sheet: Worksheet, r: number, cols: number): Snap[] {
  const out: Snap[] = [];
  for (let c = 1; c <= cols; c++) {
    const cell = sheet.getCell(r, c);
    const value = cell.formula ? { formula: cell.formula } : cell.value;
    out.push({ col: c, value, style: structuredClone(cell.style ?? {}) });
  }
  return out;
}

/**
 * Adds worker slots (G-HRS + OT HOURS row pairs) by copying the template's
 * last slot, so styles, merges and per-row formulas stay identical; totals
 * below are moved down and their ranges extended to cover the new rows.
 */
export function expandClaimSlots(sheet: Worksheet, slots: { g: number; ot: number }[], extra: number, serialCol: number) {
  if (extra <= 0 || !slots.length) return;
  const last = slots[slots.length - 1];
  const insertAt = last.ot + 1;
  const delta = extra * 2;
  const cols = Math.max(sheet.columnCount, sheet.actualColumnCount);
  const endRow = Math.max(sheet.rowCount, insertAt);
  const merges: string[] = [...((sheet.model as { merges?: string[] }).merges ?? [])];

  const slotRows = [snapRow(sheet, last.g, cols), snapRow(sheet, last.ot, cols)];
  const slotHeights = [sheet.getRow(last.g).height, sheet.getRow(last.ot).height];
  const footer: { r: number; height?: number; cells: Snap[] }[] = [];
  for (let r = insertAt; r <= endRow; r++) footer.push({ r, height: sheet.getRow(r).height, cells: snapRow(sheet, r, cols) });

  const slotMerges = merges.map(parse).filter((m) => m && m.r1 >= last.g && m.r2 <= last.ot) as NonNullable<ReturnType<typeof parse>>[];
  const footerMerges = merges.map(parse).filter((m) => m && m.r1 >= insertAt) as NonNullable<ReturnType<typeof parse>>[];
  for (const m of footerMerges) { try { sheet.unMergeCells(`${m.c1}${m.r1}:${m.c2}${m.r2}`); } catch { /* not merged */ } }
  for (const f of footer) for (const s of f.cells) { const cell = sheet.getCell(f.r, s.col); cell.value = null; cell.style = {}; }

  const lastSerial = Number(sheet.getCell(last.g, serialCol || 1).value) || slots.length;
  for (let k = 0; k < extra; k++) {
    const base = insertAt + k * 2;
    slotRows.forEach((cells, i) => {
      const r = base + i;
      const offset = r - (i ? last.ot : last.g);
      if (slotHeights[i]) sheet.getRow(r).height = slotHeights[i]!;
      for (const s of cells) {
        const cell = sheet.getCell(r, s.col);
        const v = s.value as { formula?: string } | null;
        cell.value = v && typeof v === "object" && "formula" in v && v.formula
          ? { formula: shiftFormulaRows(v.formula, offset) } as never
          : (s.value as never);
        cell.style = structuredClone(s.style) as never;
      }
    });
    if (serialCol) sheet.getCell(base, serialCol).value = lastSerial + k + 1;
    for (const m of slotMerges) {
      const off = base - last.g;
      try { sheet.mergeCells(`${m.c1}${m.r1 + off}:${m.c2}${m.r2 + off}`); } catch { /* overlap */ }
    }
  }

  for (const f of footer) {
    const r = f.r + delta;
    if (f.height) sheet.getRow(r).height = f.height;
    for (const s of f.cells) {
      const cell = sheet.getCell(r, s.col);
      const v = s.value as { formula?: string } | null;
      cell.value = v && typeof v === "object" && "formula" in v && v.formula
        ? { formula: adjustFormulaForInsert(v.formula, insertAt, delta) } as never
        : (s.value as never);
      cell.style = structuredClone(s.style) as never;
    }
  }
  for (const m of footerMerges) { try { sheet.mergeCells(`${m.c1}${m.r1 + delta}:${m.c2}${m.r2 + delta}`); } catch { /* overlap */ } }

  // Formulas above the slots (e.g. headers) that total worker rows must grow too.
  for (let r = 1; r < insertAt; r++) for (let c = 1; c <= cols; c++) {
    const cell = sheet.getCell(r, c);
    if (!cell.formula) continue;
    const next = adjustFormulaForInsert(cell.formula, insertAt, delta);
    if (next !== cell.formula) cell.value = { formula: next } as never;
  }
}
