import { expect, test } from "bun:test";
import type { ClaimSheetRow, TimeCard } from "@/lib/types";
import { claimDatePreview } from "./claim-date-preview";

function card(dates: string[]): TimeCard {
  return { id: "card-1", employeeId: "worker-1", status: "Verified", periodStart: "2026-11-01", periodEnd: "2026-11-30",
    entries: dates.map(date => ({ date, normalHours: 8, otHours: 3.5, reviewApproved: true })) };
}
function snapshot(c: TimeCard): ClaimSheetRow[] {
  return c.entries.map(entry => ({ date: entry.date, normalHours: 8, otHours: 3.5, status: "Present" }));
}

test("Sunday work remains included with its exact date and hours", () => {
  const c = card(["2026-11-08"]);
  expect(claimDatePreview(c, snapshot(c))).toMatchObject([{ date: "2026-11-08", normalHours: 8, otHours: 3.5, disposition: "Included" }]);
});

test("Every partial-month date is retained without inventing unrecorded dates", () => {
  for (const [start, end] of [[15, 30], [20, 30], [1, 5], [1, 30]]) {
    const dates = Array.from({ length: end - start + 1 }, (_, i) => `2026-11-${String(start + i).padStart(2, "0")}`);
    const c = card([...dates].reverse());
    expect(claimDatePreview(c, snapshot(c)).map(row => row.date)).toEqual(dates);
  }
});

test("Preview uses the actual approved claim hours including decimal OT and explicit zero", () => {
  const c = card(["2026-11-04"]);
  expect(claimDatePreview(c, [{ date: "2026-11-04", normalHours: 7.5, otHours: 0, status: "Present" }])[0]).toMatchObject({ normalHours: 7.5, otHours: 0 });
});

test("Ignored, off and out-of-period recorded dates remain visible as excluded", () => {
  const c = card(["2026-11-01", "2026-11-02", "2026-12-01"]);
  c.entries[0] = { date: "2026-11-01", resolution: "Ignored", normalHours: 8 };
  c.entries[1] = { date: "2026-11-02", normalHours: 0, otHours: 0 };
  expect(claimDatePreview(c, []).map(row => row.disposition)).toEqual(["Ignored", "No worked hours", "Outside claim period"]);
});