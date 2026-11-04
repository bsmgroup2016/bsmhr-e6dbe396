/**
 * Company duty-hour rule: a 9-hour general duty (GW) includes a 1-hour unpaid lunch,
 * so it counts as 8 normal hours. Time after the 9-hour duty counts as OT.
 * Example: 07:00–20:00 → 8 normal + 4 OT.
 */
export const LUNCH_HOURS = 1;

export function splitDutyHours(spanHours: number, normalHours = 8) {
  const span = Math.max(0, spanHours);
  const duty = normalHours + LUNCH_HOURS;
  // Lunch is only deducted when the shift is long enough to contain it.
  const paid = span > normalHours ? Math.max(normalHours, span - LUNCH_HOURS) : span;
  const normal = Math.min(paid, normalHours);
  const ot = Math.max(0, span - duty);
  const r = (n: number) => Math.round(n * 100) / 100;
  return { generalHours: r(Math.min(span, duty)), normalHours: r(normal), otHours: r(ot) };
}

export function spanFromTimes(checkIn?: string, checkOut?: string): number | null {
  const toMin = (t?: string) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(t ?? "");
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const i = toMin(checkIn), o = toMin(checkOut);
  if (i == null || o == null) return null;
  return ((o - i + 1440) % 1440) / 60;
}
