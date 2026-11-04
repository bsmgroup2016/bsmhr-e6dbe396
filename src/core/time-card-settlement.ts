import type { TimeCard, TimeCardEntry } from "@/lib/types";
import { spanFromTimes, splitDutyHours } from "./work-hours";

export function countedCardHours(entry: TimeCardEntry, system?: { checkIn?: string; checkOut?: string; hoursWorked?: number; overtimeHours?: number }) {
  if (entry.resolution === "Ignored") return { normalHours: 0, otHours: 0 };
  const useSystem = entry.resolution === "Corrected";
  const span = spanFromTimes(useSystem ? system?.checkIn : entry.checkIn, useSystem ? system?.checkOut : entry.checkOut);
  const calculated = span === null ? { normalHours: system?.hoursWorked ?? 0, otHours: system?.overtimeHours ?? 0 } : splitDutyHours(span);
  return {
    normalHours: entry.normalHours ?? calculated.normalHours,
    otHours: entry.otHours ?? calculated.otHours,
  };
}

export function validCardHours(entries: TimeCardEntry[]) {
  return entries.every(entry => [entry.normalHours, entry.otHours].every(value => value === undefined || (Number.isFinite(value) && value >= 0)));
}

export function isCardApproved(card: TimeCard) {
  return card.status === "Verified" && card.entries.length > 0 && card.entries.every(entry => entry.reviewApproved === true) && validCardHours(card.entries);
}

export function canGenerateSettledCards(cards: TimeCard[], pendingCount: number) {
  return pendingCount === 0 && cards.length > 0 && cards.every(isCardApproved);
}