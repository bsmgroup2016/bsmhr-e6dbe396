/**
 * Employment Act leave entitlements (Singapore).
 *
 *  - Annual leave: 7 days after 3 months of service in the first year, rising
 *    by 1 day a year to a maximum of 14 days (7/8/9/10/11/12/13/14).
 *  - Outpatient sick leave: up to 14 days a year after 6 months of service.
 *  - Hospitalisation leave: up to 60 days a year (inclusive of the 14).
 *  - Childcare leave: 6 days for parents of a Singaporean child, otherwise
 *    2 days of extended childcare leave.
 *  - Maternity: 16 weeks (Singaporean child) or 12 weeks otherwise.
 *  - Paternity: 4 weeks for fathers of a Singaporean child.
 *  - NS reservist leave: paid, for Singaporean and PR operationally-ready NSmen.
 */
import type { Employee, LeaveRequest, LeaveType } from "@/lib/types";

export const MAX_ANNUAL_LEAVE = 14;
export const OUTPATIENT_MC_DAYS = 14;
export const HOSPITALISATION_MC_DAYS = 60;

export interface Entitlement {
  type: LeaveType | "Childcare Leave" | "Maternity Leave" | "Paternity Leave" | "NS Reservist";
  days: number;
  note: string;
  /** Pro-rated / conditional entitlements the employee has not yet unlocked. */
  eligible: boolean;
}

export function monthsOfService(e: Employee, on: Date = new Date()): number {
  if (!e.joinedOn) return 0;
  const start = new Date(`${e.joinedOn}T00:00:00`);
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, (on.getFullYear() - start.getFullYear()) * 12 + (on.getMonth() - start.getMonth()));
}

/** Completed years of service. */
export function yearsOfService(e: Employee, on: Date = new Date()): number {
  return Math.floor(monthsOfService(e, on) / 12);
}

/** Statutory annual leave for the current year of service. */
export function annualLeaveDays(e: Employee, on: Date = new Date()): number {
  const months = monthsOfService(e, on);
  if (months < 3) return 0;
  const years = Math.floor(months / 12);
  return Math.min(MAX_ANNUAL_LEAVE, 7 + years);
}

/** Pro-rated annual leave when less than a full year has been completed. */
export function proratedAnnualLeave(e: Employee, on: Date = new Date()): number {
  const months = monthsOfService(e, on);
  const full = annualLeaveDays(e, on);
  if (months >= 12 || full === 0) return full;
  return Math.round((full * months) / 12 * 2) / 2;
}

function isLocal(e: Employee): boolean {
  return e.passType === "Singaporean/PR";
}

export function entitlements(e: Employee, on: Date = new Date()): Entitlement[] {
  const months = monthsOfService(e, on);
  const local = isLocal(e);
  const list: Entitlement[] = [
    {
      type: "Annual Leave",
      days: proratedAnnualLeave(e, on),
      eligible: months >= 3,
      note: months < 3 ? "Available after 3 months of service" : `Year ${yearsOfService(e, on) + 1} of service`,
    },
    {
      type: "Medical Leave",
      days: months >= 6 ? OUTPATIENT_MC_DAYS : Math.max(0, Math.min(11, months - 2) + 3),
      eligible: months >= 3,
      note: months >= 6 ? "Full outpatient entitlement" : "Pro-rated between 3 and 6 months of service",
    },
    {
      type: "Hospitalisation Leave",
      days: months >= 6 ? HOSPITALISATION_MC_DAYS : 0,
      eligible: months >= 6,
      note: "Inclusive of the 14 outpatient days",
    },
    {
      type: "Childcare Leave",
      days: local ? 6 : 2,
      eligible: months >= 3,
      note: local ? "Parent of a Singaporean child" : "Extended childcare leave",
    },
  ];

  if (e.gender === "Female") {
    list.push({
      type: "Maternity Leave",
      days: local ? 112 : 84,
      eligible: months >= 3,
      note: local ? "16 weeks, Government-Paid Maternity Leave" : "12 weeks under the Employment Act",
    });
  } else {
    list.push({
      type: "Paternity Leave",
      days: local ? 28 : 0,
      eligible: local && months >= 3,
      note: local ? "4 weeks, Government-Paid Paternity Leave" : "Not applicable to foreign employees",
    });
  }

  if (local) {
    list.push({
      type: "NS Reservist",
      days: 40,
      eligible: true,
      note: "Paid ICT / in-camp training; claim make-up pay from MINDEF",
    });
  }

  return list;
}

export interface LeaveBalance {
  type: string;
  entitled: number;
  taken: number;
  balance: number;
  eligible: boolean;
  note: string;
}

/** Entitlement minus approved leave taken in the current calendar year. */
export function leaveBalances(
  e: Employee,
  requests: LeaveRequest[],
  on: Date = new Date(),
): LeaveBalance[] {
  const year = on.getFullYear();
  const mine = requests.filter(
    (r) => r.employeeId === e.id
      && r.status === "Approved"
      && new Date(r.startDate).getFullYear() === year,
  );
  return entitlements(e, on).map((ent) => {
    const taken = mine
      .filter((r) => r.type === ent.type)
      .reduce((s, r) => s + (r.days ?? 0), 0);
    return {
      type: ent.type,
      entitled: ent.days,
      taken,
      balance: Math.max(0, ent.days - taken),
      eligible: ent.eligible,
      note: ent.note,
    };
  });
}

/** Approved leave that exceeds the statutory entitlement. */
export function overdrawn(balances: LeaveBalance[]): LeaveBalance[] {
  return balances.filter((b) => b.taken > b.entitled);
}