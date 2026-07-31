import { esc, layout, list, restGet, restPatch, sendMail } from "@/lib/email.server";
import {
  generatePayrollDrafts,
  ir21Triggers,
  payrollTargetMonth,
  quotaWarnings,
} from "@/lib/automation.server";

/**
 * Automation engine — shared by the daily cron route and the admin
 * "Run now" button in Settings.
 *
 * Scheduled automation runner.
 * Call daily with header `x-cron-secret: <CRON_SECRET>`.
 *
 * 1. Expires documents whose expiry date has passed (status -> Expired).
 * 2. Sends tiered expiry reminders at 90 / 60 / 30 / 7 days for work passes,
 *    passports, FWMI insurance, safety certs and medical checkups.
 * 3. Flags active workers who have not clocked in today.
 * 4. Generates the month-end payroll draft (1st–7th of the month).
 * 5. Flags IR21 tax clearance for leavers and warns on DRC quota / levy.
 *
 * Add `?dry=1` to compute without sending or writing.
 * Add `?payroll=1` to force the payroll draft outside the 1st–7th window.
 */
const TIERS = [90, 60, 30, 7] as const;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const plus = (days: number) => iso(new Date(Date.now() + days * 86400000));

async function backOfficeRecipients(): Promise<string[]> {
  const roleRows = await restGet(`user_roles?select=user_id,role&role=in.(admin,hr,manager)`);
  const userIds = [...new Set((roleRows as any[]).map((r) => r.user_id))];
  if (userIds.length === 0) return [];
  const profiles = await restGet(`profiles?select=email,is_active&id=in.(${userIds.join(",")})`);
  return [
    ...new Set(
      (profiles as any[]).filter((p) => p.is_active !== false && p.email).map((p) => String(p.email)),
    ),
  ];
}

/** 1. Auto-expire documents past their expiry date. */
async function expireDocuments(today: string, dryRun: boolean) {
  const stale = await restGet(
    `employee_documents?select=id&expiry_date=lt.${today}&status=neq.Expired&status=neq.Superseded`,
  );
  if (stale.length === 0 || dryRun) return stale.length;
  const ok = await restPatch(
    `employee_documents?expiry_date=lt.${today}&status=neq.Expired&status=neq.Superseded`,
    { status: "Expired" },
  );
  return ok ? stale.length : 0;
}

/** 2. Tiered expiry reminders. */
async function expiryReminders(today: string) {
  const dates = TIERS.map((t) => plus(t));
  const inList = dates.join(",");

  const [docs, employees] = await Promise.all([
    restGet(
      `employee_documents?select=name,doc_type,expiry_date,employee_id&expiry_date=in.(${inList})&status=neq.Superseded&order=expiry_date.asc`,
    ),
    restGet(
      `employees?select=id,name,employee_code,pass_expiry,work_permit_expiry_date,passport_expiry,` +
        `medical_insurance_expiry,skill_cert_expiry,medical_checkup_due,security_bond_expiry,ipa_expiry_date&status=eq.Active`,
    ),
  ]);

  const empLabel = new Map(
    (employees as any[]).map((e) => [e.id, `${e.name} (${e.employee_code ?? "-"})`]),
  );

  const items: { tier: number; text: string }[] = [];
  const tierOf = (date: string) => {
    const idx = dates.indexOf(date);
    return idx >= 0 ? TIERS[idx] : null;
  };

  for (const d of docs as any[]) {
    const tier = tierOf(String(d.expiry_date).slice(0, 10));
    if (tier == null) continue;
    items.push({
      tier,
      text: `<b>${esc(d.doc_type ?? "Document")}</b> — ${esc(d.name ?? "")} · ${esc(
        empLabel.get(d.employee_id) ?? "Unknown employee",
      )} · expires <b>${esc(d.expiry_date)}</b>`,
    });
  }

  const employeeFields: [string, string][] = [
    ["Work permit", "work_permit_expiry_date"],
    ["Work pass", "pass_expiry"],
    ["Passport", "passport_expiry"],
    ["IPA validity", "ipa_expiry_date"],
    ["FWMI / medical insurance", "medical_insurance_expiry"],
    ["Skill / safety certificate", "skill_cert_expiry"],
    ["Medical checkup", "medical_checkup_due"],
    ["Security bond", "security_bond_expiry"],
  ];

  for (const e of employees as any[]) {
    for (const [label, field] of employeeFields) {
      const raw = e[field];
      if (!raw) continue;
      const date = String(raw).slice(0, 10);
      const tier = tierOf(date);
      if (tier == null) continue;
      items.push({
        tier,
        text: `<b>${label}</b> — ${esc(e.name)} (${esc(e.employee_code ?? "-")}) · expires <b>${esc(date)}</b>`,
      });
    }
  }

  const sections = TIERS.map((tier) => {
    const rows = items.filter((i) => i.tier === tier).map((i) => i.text);
    if (rows.length === 0) return "";
    return `<h2 style="font-size:15px;margin:16px 0 8px">${tier}-day notice (${rows.length})</h2>${list(rows)}`;
  }).join("");

  return { count: items.length, html: sections, today };
}

/** 3. Workers with no clock-in today. */
async function missingClockIn(today: string) {
  const [employees, attendance] = await Promise.all([
    restGet(`employees?select=id,name,employee_code,department&status=eq.Active`),
    restGet(`attendance?select=employee_id&date=eq.${today}`),
  ]);
  const punched = new Set((attendance as any[]).map((a) => a.employee_id));
  const missing = (employees as any[]).filter(
    (e) => String(e.department ?? "").toLowerCase().includes("construction") && !punched.has(e.id),
  );
  const rows = missing
    .slice(0, 60)
    .map((e) => `${esc(e.name)} (${esc(e.employee_code ?? "-")}) — no clock-in recorded`);
  if (missing.length > rows.length) rows.push(`…and ${missing.length - rows.length} more`);
  return { count: missing.length, html: rows.length ? list(rows) : "" };
}


export interface AutomationRunResult {
  date: string;
  documentsExpired: number;
  remindersQueued: number;
  missingClockIn: number;
  ir21Pending: number;
  ir21Flagged: number;
  quotaWarnings: number;
  payrollMonth: string | null;
  payrollDraftsCreated: number;
  payrollSkipped: number;
  sent: number;
}

/** Runs every automation job once and (unless dry) emails the back-office digest. */
export async function runAutomations(options: {
  dryRun?: boolean;
  forcePayroll?: boolean;
}): Promise<AutomationRunResult> {
  const dryRun = options.dryRun === true;
  const today = iso(new Date());

  const expired = await expireDocuments(today, dryRun);
  const reminders = await expiryReminders(today);
  const noPunch = await missingClockIn(today);
  const ir21 = await ir21Triggers(today, dryRun);
  const quota = await quotaWarnings();

  // Payroll drafts run in the first week of each month for the month that just
  // closed, unless the caller forces them.
  const dayOfMonth = new Date().getUTCDate();
  const runPayroll = options.forcePayroll === true || dayOfMonth <= 7;
  const payroll = runPayroll ? await generatePayrollDrafts(payrollTargetMonth(), dryRun) : null;

  const blocks: string[] = [];
  if (reminders.count > 0) {
    blocks.push(`<h2 style="font-size:16px;margin:0 0 4px">Upcoming expiries</h2>${reminders.html}`);
  }
  if (noPunch.count > 0) {
    blocks.push(
      `<h2 style="font-size:16px;margin:16px 0 4px">No clock-in today (${noPunch.count})</h2>${noPunch.html}`,
    );
  }
  if (ir21.count > 0) {
    blocks.push(
      `<h2 style="font-size:16px;margin:16px 0 4px">IR21 tax clearance pending (${ir21.count})</h2>${ir21.html}`,
    );
  }
  if (quota.count > 0) {
    blocks.push(
      `<h2 style="font-size:16px;margin:16px 0 4px">Quota &amp; levy warnings (${quota.count})</h2>${quota.html}`,
    );
  }
  if (payroll && payroll.created > 0) {
    blocks.push(
      `<h2 style="font-size:16px;margin:16px 0 4px">Payroll drafts created for ${esc(
        payroll.month,
      )} (${payroll.created})</h2>${payroll.html}
       <p style="color:#64748b">Review and approve them in Payroll before paying.</p>`,
    );
  }
  if (expired > 0) {
    blocks.push(
      `<p style="color:#64748b">${expired} document(s) were marked <b>Expired</b> automatically.</p>`,
    );
  }

  const result: AutomationRunResult = {
    date: today,
    documentsExpired: expired,
    remindersQueued: reminders.count,
    missingClockIn: noPunch.count,
    ir21Pending: ir21.count,
    ir21Flagged: ir21.flagged,
    quotaWarnings: quota.count,
    payrollMonth: payroll?.month ?? null,
    payrollDraftsCreated: payroll?.created ?? 0,
    payrollSkipped: payroll?.skipped ?? 0,
    sent: 0,
  };

  if (blocks.length === 0 || dryRun) return result;

  const recipients = await backOfficeRecipients();
  if (recipients.length === 0) return result;

  await sendMail({
    to: recipients,
    subject:
      `BSM automation — ${reminders.count} expiry notice(s), ${noPunch.count} missing clock-in` +
      (payroll && payroll.created > 0 ? `, ${payroll.created} payroll draft(s)` : "") +
      (ir21.count > 0 ? `, ${ir21.count} IR21` : ""),
    html: layout(`Automation run — ${today}`, blocks.join("")),
  });
  return { ...result, sent: recipients.length };
}
