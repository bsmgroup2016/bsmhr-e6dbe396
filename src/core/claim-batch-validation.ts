import type { TimeCard } from "@/lib/types";

export function claimBatchProblem(cards: TimeCard[], month: string): string | null {
  const seen = new Map<string, Set<string>>();
  for (const card of cards) {
    if (!card.periodStart.startsWith(month)) return "Cards cover different months. Review Claim Month before generating.";
    const identity = card.employeeId || card.entries.find(row => row.employeeCode)?.employeeCode?.trim().toUpperCase() || card.entries.find(row => row.fin)?.fin?.trim().toUpperCase();
    const dates = seen.get(identity || card.id) ?? new Set<string>();
    for (const row of card.entries) {
      if (row.resolution !== "Ignored" && row.resolution !== "Corrected" && (row.checkIn || row.checkOut) && !(row.checkIn && row.checkOut) && row.normalHours === undefined && row.otHours === undefined) return `Incomplete hours on ${row.date}. Review both times or enter GW/OT hours before approval.`;
      const date = new Date(`${row.date}T00:00:00Z`);
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== row.date || !row.date.startsWith(month)) return `Date ${row.date} is outside the valid claim month. Review the card; no dates will be dropped.`;
      if (dates.has(row.date)) return `Duplicate worker/date ${identity || card.id} · ${row.date}. Remove the duplicate card or review its dates before generating.`;
      dates.add(row.date);
    }
    seen.set(identity || card.id, dates);
  }
  return null;
}