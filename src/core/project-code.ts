/** Company letter for project codes: BSM → B, VRL → V, Pluto → P; others use their first letter. */
export function projectCodeLetter(company?: { name?: string; code?: string }): string {
  const t = `${company?.code ?? ""} ${company?.name ?? ""}`.toUpperCase();
  if (/\bBSM\b/.test(t)) return "B";
  if (/\bVRL\b/.test(t)) return "V";
  if (/\bPLT\b|PLUTO/.test(t)) return "P";
  const first = (company?.code || company?.name || "").trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "X";
}

/** Next short code for a letter, e.g. existing V01, V02 → V03 (two digits minimum). */
export function nextProjectCode(letter: string, existingCodes: string[]): string {
  const re = new RegExp(`^${letter}(\\d+)$`, "i");
  const max = existingCodes.reduce((m, c) => { const x = re.exec(c.trim()); return x ? Math.max(m, Number(x[1])) : m; }, 0);
  return `${letter}${String(max + 1).padStart(2, "0")}`;
}
