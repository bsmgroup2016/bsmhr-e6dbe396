-- Demo billing data so Billing & Invoicing page shows real content
insert into public.rate_agreements (client_id, project_id, trade, unit, normal_rate, ot_rate, effective_from, status, remarks)
select c.id, p.id, t.trade, 'Daily', t.rate, t.ot, current_date - 90, 'Active', 'Demo rate agreement'
from public.clients c
join public.projects p on p.client_id = c.id
join (values ('General Worker',95,14),('Welder',135,20),('Scaffolder',120,18)) as t(trade,rate,ot) on true
where not exists (select 1 from public.rate_agreements r where r.client_id=c.id and r.project_id=p.id and r.trade=t.trade);

insert into public.client_contracts (company_id, client_id, project_id, contract_no, title, start_date, end_date,
  billing_cycle, billing_day, billing_source, fixed_amount, gst_rate, payment_terms_days, auto_invoice, next_invoice_on, status, remarks)
select c.company_id, c.id, p.id,
  'CT-' || to_char(current_date,'YYYY') || '-' || lpad((row_number() over (order by p.name))::text,3,'0'),
  p.name || ' — Manpower Supply Agreement',
  current_date - 60, current_date + 300, 'Monthly', 1, 'Timesheet', 0, 9, 30, true,
  date_trunc('month', current_date + interval '1 month')::date, 'Active', 'Demo contract'
from public.projects p join public.clients c on c.id = p.client_id
where not exists (select 1 from public.client_contracts x where x.project_id = p.id);

-- Invoices: Paid, Partially Paid, Sent, Draft, Overdue
with base as (
  select p.id pid, p.name pname, c.id cid, c.company_id comp,
         row_number() over (order by p.name) rn
  from public.projects p join public.clients c on c.id = p.client_id
)
insert into public.invoices (company_id, client_id, project_id, invoice_no, period_start, period_end,
  issue_date, due_date, lines, subtotal, gst_rate, gst_amount, total, amount_paid, status, notes)
select comp, cid, pid,
  'INV-' || to_char(current_date,'YYYY') || '-' || lpad(rn::text,4,'0'),
  (date_trunc('month', current_date) - interval '1 month')::date,
  (date_trunc('month', current_date) - interval '1 day')::date,
  (date_trunc('month', current_date))::date,
  (date_trunc('month', current_date) + interval '30 days')::date,
  jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid(), 'description', pname || ' — General Worker (normal + OT)',
      'trade','General Worker','quantity', 22, 'unit','Daily','rate', 95, 'otQuantity', 40, 'otRate', 14,
      'amount', 22*95 + 40*14, 'createdAt', now()),
    jsonb_build_object('id', gen_random_uuid(), 'description', pname || ' — Welder (normal + OT)',
      'trade','Welder','quantity', 18, 'unit','Daily','rate', 135, 'otQuantity', 26, 'otRate', 20,
      'amount', 18*135 + 26*20, 'createdAt', now())
  ),
  (22*95 + 40*14) + (18*135 + 26*20),
  9,
  round(((22*95 + 40*14) + (18*135 + 26*20)) * 0.09, 2),
  round(((22*95 + 40*14) + (18*135 + 26*20)) * 1.09, 2),
  case (rn % 5) when 1 then round(((22*95 + 40*14) + (18*135 + 26*20)) * 1.09, 2)
                when 2 then round(((22*95 + 40*14) + (18*135 + 26*20)) * 0.5, 2) else 0 end,
  case (rn % 5) when 1 then 'Paid' when 2 then 'Partially Paid' when 3 then 'Sent'
                when 4 then 'Overdue' else 'Draft' end,
  'Demo invoice generated from timesheets'
from base
where not exists (select 1 from public.invoices i where i.project_id = base.pid);
