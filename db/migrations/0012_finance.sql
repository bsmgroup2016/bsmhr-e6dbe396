-- Phase 12: Finance (expenses + client payment receipts)

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  expense_date date not null default current_date,
  category text not null default 'Other',
  description text not null default '',
  vendor text,
  project_id uuid references public.projects(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  amount numeric not null default 0,
  gst_amount numeric not null default 0,
  payment_mode text,
  reference_no text,
  status text not null default 'Pending',
  paid_on date,
  document_url text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  receipt_no text not null,
  received_on date not null default current_date,
  amount numeric not null default 0,
  payment_mode text not null default 'Bank Transfer',
  reference_no text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
grant select, insert, update, delete on public.payment_receipts to authenticated;
grant all on public.payment_receipts to service_role;

alter table public.expenses enable row level security;
alter table public.payment_receipts enable row level security;

drop policy if exists "staff read expenses" on public.expenses;
create policy "staff read expenses" on public.expenses
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

drop policy if exists "staff write expenses" on public.expenses;
create policy "staff write expenses" on public.expenses
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

drop policy if exists "staff read receipts" on public.payment_receipts;
create policy "staff read receipts" on public.payment_receipts
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

drop policy if exists "staff write receipts" on public.payment_receipts;
create policy "staff write receipts" on public.payment_receipts
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create index if not exists idx_expenses_date on public.expenses(expense_date);
create index if not exists idx_expenses_category on public.expenses(category);
create index if not exists idx_receipts_invoice on public.payment_receipts(invoice_id);
create index if not exists idx_receipts_date on public.payment_receipts(received_on);
