/**
 * Small formula evaluator for previewing claim sheets in the browser.
 * Supports numbers, strings, cell refs, ranges, + - * /, parentheses, SUM, COUNT,
 * AVERAGE, MIN, MAX and the template's DATE/WEEKDAY/CHOOSE date headers.
 * Anything else yields an error string, never a guess.
 */
export type Getter = (row: number, col: number) => { formula?: string; value: unknown };
export type EvalResult = number | string | null;

const colNum = (letters: string) => letters.split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
const isErr = (v: unknown): v is string => typeof v === "string" && v.startsWith("#");

export function createEvaluator(get: Getter) {
  const memo = new Map<string, EvalResult>();
  const busy = new Set<string>();

  function cellValue(row: number, col: number): EvalResult {
    const key = `${row}:${col}`;
    if (memo.has(key)) return memo.get(key)!;
    if (busy.has(key)) return "#CIRC";
    const c = get(row, col);
    let out: EvalResult;
    if (c.formula) {
      busy.add(key);
      try { out = evaluate(c.formula); } catch { out = "#ERROR"; }
      busy.delete(key);
    } else {
      const v = c.value;
      out = typeof v === "number" ? v : v === null || v === undefined || v === "" ? null : String(v);
    }
    memo.set(key, out);
    return out;
  }

  function evaluate(formula: string): EvalResult {
    const src = formula.replace(/^=/, "").replace(/\$/g, "");
    let i = 0;
    const peek = () => src[i];
    const skip = () => { while (src[i] === " ") i++; };

    type V = EvalResult | EvalResult[];
    const num = (v: V): number | string => {
      if (Array.isArray(v)) return "#VALUE!";
      if (isErr(v)) return v;
      if (v === null) return 0;
      if (typeof v === "number") return v;
      const n = Number(v); return Number.isFinite(n) && String(v).trim() !== "" ? n : "#VALUE!";
    };

    function primary(): V {
      skip();
      if (peek() === "(") { i++; const v = expr(); skip(); if (peek() !== ")") throw 0; i++; return v; }
      if (peek() === "-") { i++; const v = num(primary()); return typeof v === "number" ? -v : v; }
      if (peek() === "+") { i++; return primary(); }
      if (peek() === '"') {
        i++;
        let out = "";
        while (i < src.length) {
          if (src[i] === '"') {
            if (src[i + 1] === '"') { out += '"'; i += 2; continue; }
            i++;
            return out;
          }
          out += src[i]!;
          i++;
        }
        throw 0;
      }
      const m = src.slice(i).match(/^(\d+(?:\.\d+)?)|^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?|^([A-Z]+)\(/i);
      if (!m) throw 0;
      if (m[1]) { i += m[1].length; return Number(m[1]); }
      if (m[6]) {
        i += m[0].length;
        const args: V[] = [];
        skip();
        if (peek() !== ")") for (;;) { args.push(expr()); skip(); if (peek() === ",") { i++; continue; } break; }
        if (peek() !== ")") throw 0; i++;
        const flat = args.flatMap((a) => (Array.isArray(a) ? a : [a]));
        const firstErr = flat.find(isErr); if (firstErr) return firstErr;
        const nums = flat.filter((v): v is number => typeof v === "number");
        switch (m[6].toUpperCase()) {
          case "SUM": return nums.reduce((a, b) => a + b, 0);
          case "COUNT": return nums.length;
          case "AVERAGE": return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : "#DIV/0!";
          case "MIN": return nums.length ? Math.min(...nums) : 0;
          case "MAX": return nums.length ? Math.max(...nums) : 0;
          case "DATE": {
            if (nums.length !== 3) return "#VALUE!";
            return Date.UTC(nums[0]!, nums[1]! - 1, nums[2]!) / 86400000 + 25569;
          }
          case "WEEKDAY": {
            const serial = nums[0];
            return serial === undefined ? "#VALUE!" : new Date((serial - 25569) * 86400000).getUTCDay() + 1;
          }
          case "CHOOSE": {
            const index = num(args[0] ?? null);
            if (typeof index !== "number" || !Number.isInteger(index) || index < 1) return "#VALUE!";
            return args[index] ?? "#VALUE!";
          }
          default: return "#NAME?";
        }
      }
      i += m[0].length;
      const r1 = Number(m[3]), c1 = colNum(m[2]!.toUpperCase());
      if (!m[4]) return cellValue(r1, c1);
      const r2 = Number(m[5]), c2 = colNum(m[4].toUpperCase());
      const out: EvalResult[] = [];
      for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
        for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) out.push(cellValue(r, c));
      return out;
    }
    function term(): V {
      let left = primary();
      for (;;) {
        skip(); const op = peek();
        if (op !== "*" && op !== "/") return left;
        i++; const a = num(left), b = num(primary());
        if (typeof a === "string") left = a; else if (typeof b === "string") left = b;
        else left = op === "*" ? a * b : b === 0 ? "#DIV/0!" : a / b;
      }
    }
    function expr(): V {
      let left = term();
      for (;;) {
        skip(); const op = peek();
        if (op !== "+" && op !== "-") return left;
        i++; const a = num(left), b = num(term());
        if (typeof a === "string") left = a; else if (typeof b === "string") left = b;
        else left = op === "+" ? a + b : a - b;
      }
    }
    const v = expr(); skip();
    if (i < src.length) throw 0;
    return Array.isArray(v) ? "#VALUE!" : v;
  }

  return { cellValue, isError: isErr };
}
