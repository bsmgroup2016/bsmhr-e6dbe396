-- Loan / salary-advance ledger with repayment tracking.
create table if not exists public.employee_loans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  loan_no text not null default '',
  loan_type text not null default 'Salary Advance',
  principal numeric not null default 0,
  issued_on date,
  first_deduction_month text,
  monthly_installment numeric not null default 0,
  purpose text,
  consent_signed boolean not null default false,
  consent_document_url text,
  status text not null default 'Active',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loan_repayments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.employee_loans(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  paid_on date,
  month text,
  amount numeric not null default 0,
  source text not null default 'Payroll',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_loans_employee_idx on public.employee_loans(employee_id);
create index if not exists loan_repayments_loan_idx on public.loan_repayments(loan_id);

grant select, insert, update, delete on public.employee_loans to authenticated;
grant all on public.employee_loans to service_role;
grant select, insert, update, delete on public.loan_repayments to authenticated;
grant all on public.loan_repayments to service_role;

alter table public.employee_loans enable row level security;
alter table public.loan_repayments enable row level security;

drop policy if exists "staff read employee loans" on public.employee_loans;
create policy "staff read employee loans" on public.employee_loans for select to authenticated
using (
  has_role(auth.uid(), 'admin'::app_role)
  or has_role(auth.uid(), 'manager'::app_role)
  or has_role(auth.uid(), 'hr'::app_role)
  or exists (select 1 from public.employees e where e.id = employee_loans.employee_id and e.user_id = auth.uid())
);

drop policy if exists "staff write employee loans" on public.employee_loans;
create policy "staff write employee loans" on public.employee_loans for all to authenticated
using (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'hr'::app_role))
with check (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'hr'::app_role));

drop policy if exists "staff read loan repayments" on public.loan_repayments;
create policy "staff read loan repayments" on public.loan_repayments for select to authenticated
using (
  has_role(auth.uid(), 'admin'::app_role)
  or has_role(auth.uid(), 'manager'::app_role)
  or has_role(auth.uid(), 'hr'::app_role)
  or exists (select 1 from public.employees e where e.id = loan_repayments.employee_id and e.user_id = auth.uid())
);

drop policy if exists "staff write loan repayments" on public.loan_repayments;
create policy "staff write loan repayments" on public.loan_repayments for all to authenticated
using (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'hr'::app_role))
with check (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'hr'::app_role));
