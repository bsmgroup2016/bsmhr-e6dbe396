export const DATA_PAGE_SIZE = 200;

export function periodForMonth(month: string): { from: string; to: string } {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Month must be YYYY-MM");
  const [year, number] = month.split("-").map(Number);
  const last = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

/** Exports/derived reports never rely on the visible page or a 1,000-row response. */
export async function collectAllPages<T>(read: (offset: number, limit: number) => Promise<{ rows: T[]; total: number }>): Promise<T[]> {
  const result: T[] = [];
  let offset = 0;
  for (;;) {
    const page = await read(offset, DATA_PAGE_SIZE);
    result.push(...page.rows);
    offset += page.rows.length;
    if (offset >= page.total) return result;
    if (!page.rows.length) throw new Error("Incomplete data: a page was empty before the reported total.");
  }
}