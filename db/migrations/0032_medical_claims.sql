-- Medical claim tracking (FWMI / WICA): hospital bills, insurer settlement,
-- and how much the employer or worker ends up paying.
create table if not exists public.medical_claims (
  id uuid primary key default gen_random_uuid(),
  company_id uuid,
  employee_id uuid not null references public.employees(id) on delete cascade,
  claim_no text not null default '',
  claim_type text not null default 'Inpatient',
  treatment_date date,
  provider text,
  diagnosis text,
  total_amount numeric(12,2) not null default 0,
  insurer text,
  policy_no text,
  insurer_paid numeric(12,2) not null default 0,
  employer_paid numeric(12,2) not null default 0,
  employee_paid numeric(12,2) not null default 0,
  work_injury boolean not null default false,
  mom_reported boolean not null default false,
  status text not null default 'Draft',
  submitted_on date,
  settled_on date,
  document_url text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.medical_claims to authenticated;
grant all on public.medical_claims to service_role;

alter table public.medical_claims enable row level security;

drop policy if exists "staff read medical claims" on public.medical_claims;
create policy "staff read medical claims" on public.medical_claims
  for select to authenticated
  using (
    public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'manager')
    or public.has_role(auth.uid(),'hr')
    or exists (select 1 from public.employees e
               where e.id = medical_claims.employee_id and e.user_id = auth.uid())
  );

drop policy if exists "staff write medical claims" on public.medical_claims;
create policy "staff write medical claims" on public.medical_claims
  for all to authenticated
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'hr'))
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'hr'));

create index if not exists medical_claims_employee_idx on public.medical_claims(employee_id);
create index if not exists medical_claims_status_idx on public.medical_claims(status);
