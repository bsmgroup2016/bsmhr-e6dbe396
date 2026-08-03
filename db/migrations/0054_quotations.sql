-- Quotation management (client quotes -> rate agreements / contracts)
create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  client_id uuid not null references public.clients(id) on delete cascade,
  project_id uuid,
  quote_no text not null,
  title text not null default '',
  contact_person text,
  quote_date date,
  valid_until date,
  lines jsonb not null default '[]'::jsonb,
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  gst_rate numeric not null default 9,
  gst_amount numeric not null default 0,
  total numeric not null default 0,
  status text not null default 'Draft',
  payment_terms_days int not null default 30,
  prepared_by text,
  sent_on date,
  decided_on date,
  converted_contract_id uuid,
  terms text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists quotations_no_idx on public.quotations(quote_no);
create index if not exists quotations_client_idx on public.quotations(client_id);

grant select, insert, update, delete on public.quotations to authenticated;
grant all on public.quotations to service_role;

alter table public.quotations enable row level security;

drop policy if exists "staff read quotations" on public.quotations;
create policy "staff read quotations" on public.quotations
  for select to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'manager') or public.has_role(auth.uid(),'hr'));

drop policy if exists "staff write quotations" on public.quotations;
create policy "staff write quotations" on public.quotations
  for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'manager'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'manager'));
