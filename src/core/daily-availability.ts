/**
 * Daily attendance-based availability (Singapore time):
 * - Sunday is the weekly off: never counted Available for missing attendance.
 * - Approved leave (incl. medical) that day: On Leave, never Available.
 * - Checked in today: Working (at the site of that check-in).
 * - Other days, after 12:00 with no attendance: Available for the day.
 * - Before 12:00 with no attendance: unchanged (assignment decides).
 */
export type DailyState = "weekly_off" | "on_leave" | "working" | "available_no_attendance" | "pending";

export const NOON_CUTOFF_MINUTES = 12 * 60;

export function singaporeParts(now: Date) {
  const sg = new Date(now.getTime() + 8 * 3600_000);
  return { date: sg.toISOString().slice(0, 10), weekday: sg.getUTCDay(), minutes: sg.getUTCHours() * 60 + sg.getUTCMinutes() };
}

export function dailyState(now: Date, opts: { checkedIn: boolean; onLeave: boolean }): DailyState {
  const { weekday, minutes } = singaporeParts(now);
  if (opts.onLeave) return "on_leave";
  if (opts.checkedIn) return "working";
  if (weekday === 0) return "weekly_off";
  return minutes >= NOON_CUTOFF_MINUTES ? "available_no_attendance" : "pending";
}

/** Leave rows covering the date with status Approved. */
export function onLeaveIds(leave: Array<{ employeeId: string; startDate: string; endDate: string; status: string }>, date: string) {
  return new Set(leave.filter((l) => l.status === "Approved" && l.startDate <= date && l.endDate >= date).map((l) => l.employeeId));
}
