-- Demo billing data: clients/projects for VRL & Pluto, rate agreements,
-- contracts and 6 months of invoices with mixed statuses.
do $$
declare
  bsm uuid; vrl uuid; pluto uuid;
begin
  select id into bsm from public.companies where name = 'BSM';
  select id into vrl from public.companies where name = 'VRL';
  select id into pluto from public.companies where name = 'Pluto';

  -- clients
  insert into public.clients (company_id, code, name, contact_person, email, phone, address, industry, status, contract_start, contract_end)
  values
    (vrl,   'VRL-C01', 'Jurong Port Logistics',      'Tan Wei Ming',  'ap@jurongport.demo',   '+65 6111 2201', '37 Jurong Port Rd, Singapore',   'Logistics',    'Active', current_date - 400, current_date + 300),
    (vrl,   'VRL-C02', 'Sim Lian Construction',      'Ravi Kumar',    'ap@simlian.demo',      '+65 6111 2202', '10 Kaki Bukit Ave 4, Singapore', 'Construction', 'Active', current_date - 250, current_date + 400),
    (pluto, 'PLT-C01', 'Changi Facility Services',   'Nur Aisyah',    'ap@changifs.demo',     '+65 6111 2203', '80 Airport Blvd, Singapore',     'Facilities',   'Active', current_date - 300, current_date + 200),
    (pluto, 'PLT-C02', 'Sembawang Shipyard Works',   'Lim Hock Seng', 'ap@sbwyard.demo',      '+65 6111 2204', '27 Admiralty Rd W, Singapore',   'Marine',       'Active', current_date - 500, current_date + 150)
  on conflict (code) do nothing;

  -- projects
  insert into public.projects (client_id, code, name, location, status, start_date, end_date, required_workers, project_manager, safety_officer)
  select c.id, c.code || '-P1', p.pname, p.loc, 'Active', current_date - 200, current_date + 200, p.req, p.pm, p.so
  from public.clients c
  join (values
    ('VRL-C01', 'Jurong Port Yard Handling',     'Jurong',    45, 'Alvin Goh',   'Suresh N'),
    ('VRL-C02', 'Kaki Bukit Condo Package B',    'Kaki Bukit',60, 'Steven Yeo',  'Md Alamin'),
    ('PLT-C01', 'Changi T4 Cleaning & M&E',      'Changi',    35, 'Farah Diana', 'Kwok Wei'),
    ('PLT-C02', 'Sembawang Hull Blasting',       'Sembawang', 50, 'Jason Teo',   'Rakib Hasan')
  ) as p(ccode, pname, loc, req, pm, so) on p.ccode = c.code
  on conflict (code) do nothing;

  -- rate agreements for the new clients
  insert into public.rate_agreements (client_id, project_id, trade, unit, normal_rate, ot_rate, effective_from, effective_to, status, remarks)
  select c.id, pr.id, t.trade, 'Daily', t.nr, t.otr, current_date - 180, current_date + 180, 'Active', 'Demo rate card'
  from public.clients c
  join public.projects pr on pr.client_id = c.id
  join (values ('General Worker', 95, 14), ('Welder', 135, 20), ('Supervisor', 165, 24)) as t(trade, nr, otr) on true
  where c.code in ('VRL-C01','VRL-C02','PLT-C01','PLT-C02')
    and not exists (select 1 from public.rate_agreements ra where ra.client_id = c.id);

  -- contracts for the new clients
  insert into public.client_contracts (company_id, client_id, project_id, contract_no, title, start_date, end_date,
    billing_cycle, billing_day, billing_source, fixed_amount, gst_rate, payment_terms_days, auto_invoice, last_invoiced_on, next_invoice_on, status, remarks)
  select c.company_id, c.id, pr.id, 'CT-' || c.code, c.name || ' — Manpower Supply Agreement',
    current_date - 180, current_date + 180, 'Monthly', 1, 'Timesheet', 0, 9, 30, true,
    date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month')::date, 'Active', 'Demo contract'
  from public.clients c
  join public.projects pr on pr.client_id = c.id
  where c.code in ('VRL-C01','VRL-C02','PLT-C01','PLT-C02')
    and not exists (select 1 from public.client_contracts cc where cc.client_id = c.id);
end $$;

-- Rebuild demo invoices: 6 months history, mixed statuses
delete from public.invoices;

insert into public.invoices (company_id, client_id, project_id, invoice_no, period_start, period_end, issue_date, due_date,
  lines, subtotal, gst_rate, gst_amount, total, amount_paid, status, notes)
select
  c.company_id,
  c.id,
  pr.id,
  'INV-' || to_char(m.mth, 'YYYYMM') || '-' || upper(split_part(c.code, '-', 1)) || lpad((row_number() over (partition by m.mth order by c.code))::text, 2, '0'),
  m.mth::date,
  (m.mth + interval '1 month - 1 day')::date,
  (m.mth + interval '1 month')::date,
  (m.mth + interval '1 month' + (v.terms || ' days')::interval)::date,
  jsonb_build_array(
    jsonb_build_object('id', gen_random_uuid(), 'description', pr.name || ' — General Worker (normal + OT)',
      'trade', 'General Worker', 'quantity', v.gw_days, 'unit', 'Daily', 'rate', 95, 'otQuantity', v.gw_ot, 'otRate', 14,
      'amount', v.gw_days * 95 + v.gw_ot * 14, 'createdAt', now()),
    jsonb_build_object('id', gen_random_uuid(), 'description', pr.name || ' — Welder (normal + OT)',
      'trade', 'Welder', 'quantity', v.wd_days, 'unit', 'Daily', 'rate', 135, 'otQuantity', v.wd_ot, 'otRate', 20,
      'amount', v.wd_days * 135 + v.wd_ot * 20, 'createdAt', now()),
    jsonb_build_object('id', gen_random_uuid(), 'description', pr.name || ' — Supervisor',
      'trade', 'Supervisor', 'quantity', v.sv_days, 'unit', 'Daily', 'rate', 165, 'otQuantity', 0, 'otRate', 24,
      'amount', v.sv_days * 165, 'createdAt', now())
  ),
  v.subtotal,
  9,
  round(v.subtotal * 0.09, 2),
  round(v.subtotal * 1.09, 2),
  case
    when v.age_months >= 3 then round(v.subtotal * 1.09, 2)
    when v.age_months = 2 then case when v.seed % 3 = 0 then round(v.subtotal * 0.5, 2) else round(v.subtotal * 1.09, 2) end
    when v.age_months = 1 then case when v.seed % 4 = 0 then round(v.subtotal * 0.4, 2) else 0 end
    else 0
  end,
  case
    when v.age_months >= 3 then 'Paid'
    when v.age_months = 2 then case when v.seed % 3 = 0 then 'Partially Paid' else 'Paid' end
    when v.age_months = 1 then case when v.seed % 4 = 0 then 'Partially Paid' else 'Overdue' end
    when v.seed % 3 = 0 then 'Draft'
    else 'Sent'
  end,
  'Demo invoice — auto-generated from timesheets'
from public.clients c
join lateral (select id, name from public.projects p where p.client_id = c.id order by p.code limit 1) pr on true
cross join lateral (select generate_series(date_trunc('month', current_date) - interval '5 month', date_trunc('month', current_date), interval '1 month') as mth) m
cross join lateral (
  select
    (extract(epoch from m.mth)::bigint / 86400 + length(c.code))::int as seed,
    round(extract(epoch from (date_trunc('month', current_date) - m.mth)) / 2592000)::int as age_months,
    30 as terms
) s
cross join lateral (
  select
    s.seed, s.age_months, s.terms,
    18 + (s.seed % 6) as gw_days,
    20 + (s.seed % 30) as gw_ot,
    14 + (s.seed % 5) as wd_days,
    12 + (s.seed % 20) as wd_ot,
    20 + (s.seed % 3) as sv_days,
    ((18 + (s.seed % 6)) * 95 + (20 + (s.seed % 30)) * 14
      + (14 + (s.seed % 5)) * 135 + (12 + (s.seed % 20)) * 20
      + (20 + (s.seed % 3)) * 165)::numeric as subtotal
) v
where c.status = 'Active';
