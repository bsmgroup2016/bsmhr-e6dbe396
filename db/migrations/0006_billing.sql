-- Phase 6: Billing & Invoicing
create table if not exists public.rate_agreements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  trade text not null default 'All',
  unit text not null default 'Hourly',
  normal_rate numeric not null default 0,
  ot_rate numeric not null default 0,
  effective_from date,
  effective_to date,
  status text not null default 'Active',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  invoice_no text not null,
  period_start date,
  period_end date,
  issue_date date,
  due_date date,
  lines jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  gst_rate numeric not null default 9,
  gst_amount numeric not null default 0,
  total numeric not null default 0,
  amount_paid numeric not null default 0,
  status text not null default 'Draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rate_agreements_client_idx on public.rate_agreements(client_id);
create index if not exists invoices_client_idx on public.invoices(client_id);
create unique index if not exists invoices_no_idx on public.invoices(invoice_no);

grant select, insert, update, delete on public.rate_agreements to authenticated;
grant all on public.rate_agreements to service_role;
grant select, insert, update, delete on public.invoices to authenticated;
grant all on public.invoices to service_role;

alter table public.rate_agreements enable row level security;
alter table public.invoices enable row level security;

drop policy if exists "rates read" on public.rate_agreements;
create policy "rates read" on public.rate_agreements for select to authenticated using (true);
drop policy if exists "rates write" on public.rate_agreements;
create policy "rates write" on public.rate_agreements for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

drop policy if exists "invoices read" on public.invoices;
create policy "invoices read" on public.invoices for select to authenticated using (true);
drop policy if exists "invoices write" on public.invoices;
create policy "invoices write" on public.invoices for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));
