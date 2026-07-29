-- Phase: client contracts & auto-invoicing
create table if not exists public.client_contracts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid,
  contract_no text not null,
  title text not null default '',
  start_date date,
  end_date date,
  billing_cycle text not null default 'Monthly',
  billing_day int not null default 1,
  billing_source text not null default 'Timesheet',
  fixed_amount numeric not null default 0,
  gst_rate numeric not null default 9,
  payment_terms_days int not null default 30,
  auto_invoice boolean not null default true,
  last_invoiced_on date,
  next_invoice_on date,
  status text not null default 'Active',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.client_contracts to authenticated;
grant all on public.client_contracts to service_role;

alter table public.client_contracts enable row level security;

drop policy if exists "staff read contracts" on public.client_contracts;
create policy "staff read contracts" on public.client_contracts
  for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'manager') or public.has_role(auth.uid(),'hr'));

drop policy if exists "staff write contracts" on public.client_contracts;
create policy "staff write contracts" on public.client_contracts
  for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'manager'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'manager'));

create index if not exists client_contracts_client_idx on public.client_contracts(client_id);
