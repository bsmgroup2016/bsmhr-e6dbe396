/**
 * Employment Act hours-of-work and overtime pay rules (Part IV).
 *
 * Applies to workmen earning up to $4,500 and other employees (non-workmen)
 * earning up to $2,600 basic monthly salary.
 *
 *  - Normal hours: 8 h/day or 44 h/week.
 *  - Overtime: 1.5x the hourly basic rate.
 *  - Rest day (at employer's request): up to half a day worked = 1 day's pay,
 *    more than half a day = 2 days' pay, beyond normal hours = 1.5x OT on top.
 *  - Public holiday: an extra day's pay plus the gross rate for the day.
 *  - Overtime is capped at 72 hours a month.
 */
import type { Employee } from "@/lib/types";

export const NORMAL_HOURS_PER_WEEK = 44;
export const NORMAL_HOURS_PER_DAY = 8;
export const OT_MULTIPLIER = 1.5;
export const OT_HOURS_CAP = 72;

/** Part IV salary ceilings. */
export const PART_IV_WORKMAN_CEILING = 4500;
export const PART_IV_NON_WORKMAN_CEILING = 2600;

const WORKMAN_CATEGORIES = ["Skilled", "Semi-Skilled", "General Worker", "Driver"];

export function isWorkman(e: Employee): boolean {
  return WORKMAN_CATEGORIES.includes(e.workerCategory ?? "General Worker");
}

/** Whether Part IV overtime protection applies to this employee. */
export function partIvCovered(e: Employee): boolean {
  const basic = e.basicSalary ?? 0;
  return isWorkman(e)
    ? basic <= PART_IV_WORKMAN_CEILING
    : basic <= PART_IV_NON_WORKMAN_CEILING;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Hourly basic rate of pay: (12 x monthly basic) / (52 x weekly hours). */
export function hourlyRate(e: Employee): number {
  const weekly = e.normalHours ?? NORMAL_HOURS_PER_WEEK;
  const basic = e.basicSalary ?? 0;
  if (!basic || !weekly) return 0;
  return round2((12 * basic) / (52 * weekly));
}

/** Daily gross rate: (12 x monthly basic) / (52 x working days per week). */
export function dailyRate(e: Employee, workingDaysPerWeek = 6): number {
  const basic = e.basicSalary ?? 0;
  if (!basic) return 0;
  return round2((12 * basic) / (52 * workingDaysPerWeek));
}

export function overtimePay(e: Employee, hours: number): number {
  if (hours <= 0) return 0;
  const rate = e.otRate ?? hourlyRate(e) * OT_MULTIPLIER;
  return round2(rate * hours);
}

export type SpecialDay = "Rest Day" | "Public Holiday";

export interface DayPay {
  basePay: number;
  otPay: number;
  total: number;
  note: string;
}

/**
 * Pay for a rest day or public holiday worked, following the Employment Act
 * multipliers. `hours` is the total hours worked on that day.
 */
export function specialDayPay(e: Employee, day: SpecialDay, hours: number, workingDaysPerWeek = 6): DayPay {
  const daily = dailyRate(e, workingDaysPerWeek);
  const normal = Math.min(hours, NORMAL_HOURS_PER_DAY);
  const otHours = Math.max(0, hours - NORMAL_HOURS_PER_DAY);
  const otPay = overtimePay(e, otHours);

  if (day === "Public Holiday") {
    return {
      basePay: round2(daily),
      otPay,
      total: round2(daily + otPay),
      note: "Extra day's salary at the basic rate, plus 1.5x for hours beyond 8",
    };
  }

  const halfDay = NORMAL_HOURS_PER_DAY / 2;
  const multiplier = normal <= halfDay ? 1 : 2;
  return {
    basePay: round2(daily * multiplier),
    otPay,
    total: round2(daily * multiplier + otPay),
    note: normal <= halfDay
      ? "Up to half a day worked on a rest day = 1 day's salary"
      : "More than half a day worked on a rest day = 2 days' salary",
  };
}

export interface OtCheck {
  hours: number;
  capped: boolean;
  excess: number;
  pay: number;
}

/** Monthly overtime check against the 72-hour cap. */
export function monthlyOvertime(e: Employee, hours: number): OtCheck {
  const excess = Math.max(0, hours - OT_HOURS_CAP);
  return { hours, capped: excess > 0, excess, pay: overtimePay(e, hours) };
}