/**
 * Draft payslip figures from a worker's monthly claim days, following the salary sheet:
 * basic = worked weekdays × daily rate, rest day (Sunday) = daily rate × 1.5,
 * OT = hours × (daily rate ÷ 8 × 1.5). Allowances, transport and deductions are added later.
 *
 * MOM requires the payslip to show the real overtime hours and pay; more than 72 OT hours in a
 * month needs an MOM exemption, so it is flagged — never moved into another pay item.
 */
export const OT_MONTHLY_LIMIT = 72;

export interface PayDay { day: number; g: number | null; ot: number | null; worked: boolean }
export interface PayslipFigures {
  dailyRate: number;
  workDays: number;
  restDays: number;
  otHours: number;
  hourlyOtRate: number;
  basicPay: number;
  restDayPay: number;
  otPay: number;
  netPay: number;
  otOverLimit: number;
}

const money = (n: number) => Math.round(n * 100) / 100;

export function payslipFigures(days: PayDay[], dailyRate: number, year: number, month: number): PayslipFigures {
  const rate = Number.isFinite(dailyRate) && dailyRate > 0 ? dailyRate : 0;
  const isSunday = (d: number) => new Date(Date.UTC(year, month - 1, d)).getUTCDay() === 0;
  const worked = days.filter((d) => d.worked && ((d.g ?? 0) + (d.ot ?? 0)) > 0);
  const restDays = worked.filter((d) => isSunday(d.day)).length;
  const workDays = worked.length - restDays;
  const otHours = money(worked.reduce((n, d) => n + (d.ot ?? 0), 0));
  // Not rounded to cents: the salary sheet multiplies hours by the exact rate (e.g. $26 → 4.875).
  const hourlyOtRate = Math.round((rate / 8) * 1.5 * 10000) / 10000;
  const basicPay = money(workDays * rate);
  const restDayPay = money(restDays * rate * 1.5);
  const otPay = money(otHours * hourlyOtRate);
  return {
    dailyRate: rate, workDays, restDays, otHours, hourlyOtRate, basicPay, restDayPay, otPay,
    netPay: money(basicPay + restDayPay + otPay),
    otOverLimit: Math.max(0, money(otHours - OT_MONTHLY_LIMIT)),
  };
}
