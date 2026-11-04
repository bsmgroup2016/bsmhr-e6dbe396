import type { ClaimSheetRow, TimeCard } from "@/lib/types";
import { countedCardHours } from "./time-card-settlement";

/** Keep every recorded date visible; included hours come from the actual claim snapshot. */
export function claimDatePreview(card: TimeCard, snapshot: ClaimSheetRow[]) {
  return [...card.entries].sort((a, b) => a.date.localeCompare(b.date)).map(entry => {
    const claim = snapshot.find(row => row.date === entry.date);
    const hours = claim ?? countedCardHours(entry);
    const disposition = claim ? "Included" : entry.resolution === "Ignored" ? "Ignored" :
      entry.date < card.periodStart || entry.date > card.periodEnd ? "Outside claim period" : "No worked hours";
    return { date: entry.date, normalHours: hours.normalHours, otHours: hours.otHours,
      site: claim?.site ?? entry.siteName ?? "", remarks: entry.remarks ?? "", disposition };
  });
}