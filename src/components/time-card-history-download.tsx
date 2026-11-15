import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cardHistoryCsv } from "@/core/time-card-history-csv";
import type { TimeCard } from "@/lib/types";

export function TimeCardHistoryDownload({ card }: { card: TimeCard }) {
  function download() {
    const blob = new Blob([cardHistoryCsv(card)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const name = (card.entries[0]?.employeeCode || card.id).replace(/[^a-zA-Z0-9_-]/g, "_");
    link.download = `card_history_${name}_${card.periodStart}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  return <Button variant="outline" size="sm" onClick={download} disabled={!card.entries.length}><Download aria-hidden="true" />Download history CSV</Button>;
}