/**
 * Server-side automation jobs used by /api/public/run-automations.
 *
 * All reads/writes go through the service-role REST helpers, so nothing here
 * depends on the browser Supabase client or on any React state.
 */
import { esc, list, restGet, restPatch, restPost } from "@/lib/email.server";
import { computeStatutory, round2 } from "@/lib/sg-payroll";
import { isOfficeStaff } from "@/lib/workforce-split";

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Month (YYYY-MM) the payroll draft should cover: the month that just closed. */
export function payrollTargetMonth(today = new Date()): string {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const monthRange = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return { from: `${month}-01`, to: iso(new Date(Date.UTC(y, m, 0))) };
};

/** Normal hours in a month a fixed-salary staff member is deemed to work. */
const STAFF_MONTH_HOURS = 44 * 4.3333;

export interface PayrollDraftResult {
  month: string;
  created: number;
  skipped: number;
  html: string;
}

/**
 * Month-end payroll draft: turns attendance into a Draft payroll entry per
 * employee, with overtime at 1.5x, CPF / SDL / SHG, levy and loan deductions.
 * Employees who already have an entry for the month are left untouched.
 */
export async function generatePayrollDrafts(
  month: string,
  dryRun: boolean,
): Promise<PayrollDraftResult> {
  const { from, to } = monthRange(month);

  const [employees, existing, attendance, loans] = await Promise.all([
    restGet(
      `employees?select=id,name,employee_code,department,trade,pass_type,date_of_birth,pr_status,` +
        `ethnic_group,religion,basic_salary,ot_rate,fixed_allowance,levy_rate&status=eq.Active`,
    ),
    restGet(`payroll_entries?select=employee_id&month=eq.${month}`),
    restGet(
      `attendance?select=employee_id,hours_worked,overtime_hours&date=gte.${from}&date=lte.${to}`,
    ),
    restGet(
      `employee_loans?select=employee_id,monthly_installment,status,first_deduction_month&status=eq.Active`,
    ),
  ]);

  const done = new Set((existing as any[]).map((e) => e.employee_id));

  const hours = new Map<string, { normal: number; ot: number; days: number }>();
  for (const a of attendance as any[]) {
    const cur = hours.get(a.employee_id) ?? { normal: 0, ot: 0, days: 0 };
    cur.normal += Number(a.hours_worked ?? 0);
    cur.ot += Number(a.overtime_hours ?? 0);
    cur.days += 1;
    hours.set(a.employee_id, cur);
  }

  const installment = new Map<string, number>();
  for (const l of loans as any[]) {
    if (l.first_deduction_month && String(l.first_deduction_month) > month) continue;
    installment.set(
      l.employee_id,
      (installment.get(l.employee_id) ?? 0) + Number(l.monthly_installment ?? 0),
    );
  }

  const rows: Record<string, unknown>[] = [];
  const lines: string[] = [];
  let skipped = 0;

  for (const e of employees as any[]) {
    if (done.has(e.id)) {
      skipped += 1;
      continue;
    }
    const person = { department: e.department, trade: e.trade };
    const staff = isOfficeStaff(person);
    const worked = hours.get(e.id);

    // Workers are paid on recorded hours; without attendance there is nothing to draft.
    if (!staff && (!worked || worked.normal <= 0)) {
      skipped += 1;
      continue;
    }

    const rate = Number(e.basic_salary ?? 0);
    const basic = staff ? round2(rate) : round2(rate * (worked?.normal ?? 0));
    const otRate = Number(e.ot_rate ?? 0) > 0
      ? Number(e.ot_rate)
      : staff
        ? round2((rate / STAFF_MONTH_HOURS) * 1.5)
        : round2(rate * 1.5);
    const otHours = round2(worked?.ot ?? 0);
    const overtimePay = round2(otRate * otHours);
    const allowances = round2(Number(e.fixed_allowance ?? 0));
    const gross = round2(basic + overtimePay + allowances);

    const stat = computeStatutory(
      {
        passType: e.pass_type,
        dateOfBirth: e.date_of_birth ?? undefined,
        prStatus: e.pr_status ?? undefined,
        ethnicGroup: e.ethnic_group ?? undefined,
        religion: e.religion ?? undefined,
        levyRate: Number(e.levy_rate ?? 0),
      } as any,
      gross,
    );

    const loan = round2(installment.get(e.id) ?? 0);
    const deductions = round2(stat.cpfEmployee + stat.shgAmount + loan);
    const netPay = round2(gross - deductions);

    rows.push({
      employee_id: e.id,
      month,
      basic_salary: basic,
      overtime_pay: overtimePay,
      overtime_hours: otHours,
      allowances,
      deductions,
      other_deductions: 0,
      loan_repayment: loan,
      cpf_employee: stat.cpfEmployee,
      cpf_employer: stat.cpfEmployer,
      sdl: stat.sdl,
      shg_fund: stat.shgFund,
      shg_amount: stat.shgAmount,
      levies: stat.levy,
      employer_cost: stat.employerCost,
      net_pay: netPay,
      status: "Draft",
    });

    if (lines.length < 25) {
      lines.push(
        `${esc(e.name)} (${esc(e.employee_code ?? "-")}) — gross <b>$${gross.toFixed(2)}</b>, ` +
          `OT ${otHours}h, net <b>$${netPay.toFixed(2)}</b>`,
      );
    }
  }

  if (rows.length > lines.length) lines.push(`…and ${rows.length - lines.length} more`);

  const created = dryRun ? rows.length : await restPost("payroll_entries", rows);
  return { month, created, skipped, html: rows.length ? list(lines) : "" };
}

/**
 * IR21 tax clearance: every foreign employee marked Resigned / Terminated must
 * be cleared at least one month before the last working day.
 */
export async function ir21Triggers(today: string, dryRun: boolean) {
  const employees = await restGet(
    `employees?select=id,name,employee_code,pass_type,status,last_working_date,ir21_required,ir21_status,ir21_filed_on` +
      `&status=in.(Resigned,Terminated,Repatriated)`,
  );

  const pending = (employees as any[]).filter(
    (e) => e.pass_type !== "Singaporean/PR" && !e.ir21_filed_on,
  );
  const toFlag = pending.filter((e) => e.ir21_required !== true);

  if (toFlag.length > 0 && !dryRun) {
    await restPatch(`employees?id=in.(${toFlag.map((e) => e.id).join(",")})`, {
      ir21_required: true,
      ir21_status: "Pending",
    });
  }

  const lines = pending.map((e) => {
    const last = e.last_working_date ? String(e.last_working_date).slice(0, 10) : null;
    const due = last
      ? iso(new Date(new Date(`${last}T00:00:00Z`).getTime() - 30 * 86400000))
      : null;
    const overdue = due != null && due < today;
    return (
      `${esc(e.name)} (${esc(e.employee_code ?? "-")}) — ${esc(e.status)}` +
      (last ? ` · last day ${esc(last)}` : " · last working day not recorded") +
      (due ? ` · IR21 due by <b>${esc(due)}</b>${overdue ? " <b>(OVERDUE)</b>" : ""}` : "")
    );
  });

  return { count: pending.length, flagged: toFlag.length, html: lines.length ? list(lines) : "" };
}

/** Dependency ratio + levy exposure warning, per company. */
export async function quotaWarnings() {
  const [companies, employees] = await Promise.all([
    restGet(`companies?select=id,name`),
    restGet(`employees?select=company_id,pass_type,levy_rate&status=eq.Active`),
  ]);

  const names = new Map((companies as any[]).map((c) => [c.id, c.name]));
  const agg = new Map<string, { local: number; foreign: number; levy: number }>();
  for (const e of employees as any[]) {
    const key = e.company_id ?? "unassigned";
    const cur = agg.get(key) ?? { local: 0, foreign: 0, levy: 0 };
    if (e.pass_type === "Singaporean/PR") cur.local += 1;
    else {
      cur.foreign += 1;
      cur.levy += Number(e.levy_rate ?? 0);
    }
    agg.set(key, cur);
  }

  // Construction DRC: up to 7 foreign workers per local worker.
  const CAP_RATIO = 7;
  const lines: string[] = [];
  for (const [id, v] of agg) {
    if (v.foreign === 0) continue;
    const allowed = v.local * CAP_RATIO;
    const label = esc(names.get(id) ?? "Unassigned company");
    if (v.local === 0) {
      lines.push(`<b>${label}</b> — ${v.foreign} foreign worker(s) with no local worker on record (DRC quota cannot be met).`);
    } else if (v.foreign > allowed) {
      lines.push(`<b>${label}</b> — ${v.foreign} foreign vs ${v.local} local; quota allows ${allowed}. <b>Over by ${v.foreign - allowed}.</b>`);
    } else if (v.foreign > allowed * 0.9) {
      lines.push(`<b>${label}</b> — ${v.foreign}/${allowed} of the DRC quota used (above 90%).`);
    }
    if (v.levy > 0) {
      lines.push(`<b>${label}</b> — monthly foreign worker levy exposure $${v.levy.toFixed(2)}.`);
    }
  }

  return { count: lines.length, html: lines.length ? list(lines) : "" };
}
