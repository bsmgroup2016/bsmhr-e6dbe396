import { createFileRoute } from "@tanstack/react-router";
import { esc, layout, list, restGet, sendMail } from "@/lib/email.server";

/**
 * Daily alert digest for back-office staff.
 * Call with header `x-cron-secret: <CRON_SECRET>` from any scheduler.
 */
async function buildAndSend(dryRun: boolean) {
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const in30 = iso(new Date(today.getTime() + 30 * 86400000));
  const todayIso = iso(today);

  const [docs, employees, leaves, invoices, roleRows] = await Promise.all([
    restGet(
      `employee_documents?select=name,doc_type,expiry_date,employee_id&expiry_date=gte.${todayIso}&expiry_date=lte.${in30}&order=expiry_date.asc`,
    ),
    restGet(
      `employees?select=id,name,employee_code,pass_expiry,work_permit_expiry_date,passport_expiry&status=eq.Active`,
    ),
    restGet(`leave_requests?select=id,employee_id,leave_type,start_date,end_date,days&status=eq.Pending`),
    restGet(`invoices?select=invoice_no,due_date,total,amount_paid,status,client_id&due_date=lt.${todayIso}`),
    restGet(`user_roles?select=user_id,role&role=in.(admin,hr,manager)`),
  ]);

  const empName = new Map(employees.map((e: any) => [e.id, `${e.name} (${e.employee_code ?? "-"})`]));

  const docItems = docs.map(
    (d: any) =>
      `<b>${esc(d.doc_type ?? "Document")}</b> — ${esc(d.name ?? "")} · ${esc(
        empName.get(d.employee_id) ?? "Unknown employee",
      )} · expires <b>${esc(d.expiry_date)}</b>`,
  );

  for (const e of employees as any[]) {
    for (const [label, date] of [
      ["Work permit", e.work_permit_expiry_date ?? e.pass_expiry],
      ["Passport", e.passport_expiry],
    ] as [string, string | null][]) {
      if (date && date >= todayIso && date <= in30) {
        docItems.push(`<b>${label}</b> — ${esc(e.name)} (${esc(e.employee_code ?? "-")}) · expires <b>${esc(date)}</b>`);
      }
    }
  }

  const leaveItems = leaves.map(
    (l: any) =>
      `${esc(empName.get(l.employee_id) ?? "Employee")} · ${esc(l.leave_type)} · ${esc(l.start_date)} → ${esc(
        l.end_date,
      )} (${esc(l.days)} day(s)) — awaiting approval`,
  );

  const overdue = (invoices as any[]).filter(
    (i) => String(i.status).toLowerCase() !== "paid" && Number(i.total) > Number(i.amount_paid ?? 0),
  );
  const invoiceItems = overdue.map(
    (i) =>
      `Invoice <b>${esc(i.invoice_no)}</b> · due ${esc(i.due_date)} · outstanding <b>$${(
        Number(i.total) - Number(i.amount_paid ?? 0)
      ).toFixed(2)}</b>`,
  );

  const total = docItems.length + leaveItems.length + invoiceItems.length;
  if (total === 0) return { sent: 0, items: 0 };

  const userIds = [...new Set((roleRows as any[]).map((r) => r.user_id))];
  if (userIds.length === 0) return { sent: 0, items: total };
  const profiles = await restGet(
    `profiles?select=email,is_active&id=in.(${userIds.join(",")})`,
  );
  const recipients = [
    ...new Set(
      (profiles as any[])
        .filter((p) => p.is_active !== false && p.email)
        .map((p) => String(p.email)),
    ),
  ];
  if (recipients.length === 0) return { sent: 0, items: total };

  const html = layout(
    `Daily alerts — ${todayIso}`,
    `<h2 style="font-size:15px;margin:16px 0 8px">Expiring within 30 days (${docItems.length})</h2>
     ${list(docItems)}
     <h2 style="font-size:15px;margin:16px 0 8px">Leave requests awaiting approval (${leaveItems.length})</h2>
     ${list(leaveItems)}
     <h2 style="font-size:15px;margin:16px 0 8px">Overdue invoices (${invoiceItems.length})</h2>
     ${list(invoiceItems)}`,
  );

  if (dryRun) return { sent: 0, items: total, recipients: recipients.length };
  await sendMail({ to: recipients, subject: `BSM daily alerts — ${total} item(s)`, html });
  return { sent: recipients.length, items: total };
}

export const Route = createFileRoute("/api/public/send-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        if (!secret || request.headers.get("x-cron-secret") !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const url = new URL(request.url);
          const result = await buildAndSend(url.searchParams.get("dry") === "1");
          return Response.json(result);
        } catch (e) {
          return new Response(e instanceof Error ? e.message : "Failed", { status: 500 });
        }
      },
    },
  },
});