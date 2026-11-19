/** Allowed P-File Number prefixes per company (company-assigned worker identity). */
export const PFILE_PREFIXES: Record<string, readonly string[]> = {
  BSM: ["B", "BS"],
  Pluto: ["P", "PC", "PS"],
  VRL: ["V"],
};

export function prefixesForCompany(company?: string): readonly string[] {
  const key = (company ?? "").trim().toLowerCase();
  if (key.includes("pluto") && /pte\s*0?1\b/.test(key)) return ["P"];
  if (key.includes("pluto") && /pte\s*0?2\b/.test(key)) return ["PC"];
  const hit = Object.keys(PFILE_PREFIXES).find((name) => key && (key === name.toLowerCase() || key.includes(name.toLowerCase())));
  return hit ? PFILE_PREFIXES[hit] : [];
}

export function plutoBranchPrefix(branch?: string): string | undefined {
  const key = (branch ?? "").trim().toLowerCase();
  if (!key.includes("pluto")) return undefined;
  if (/pte\s*0?1\b/.test(key)) return "P";
  if (/pte\s*0?2\b/.test(key)) return "PC";
  return undefined;
}

/** Next P-File Number for an exact prefix, e.g. P-99 → P-100 (PC-* numbers are counted separately). */
export function nextPFileNumber(prefix: string, existingCodes: readonly (string | undefined)[]): string {
  const p = prefix.toUpperCase();
  const re = new RegExp(`^${p}[^a-z0-9]*(\\d+)$`, "i");
  let max = 0;
  for (const code of existingCodes) {
    const m = re.exec((code ?? "").trim());
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${p}-${String(max + 1).padStart(2, "0")}`;
}
