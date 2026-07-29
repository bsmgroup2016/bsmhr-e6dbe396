-- Phase 10: Recruitment (job requisitions + candidate pipeline)

create table if not exists public.job_requisitions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  code text not null default '',
  title text not null,
  trade text default '',
  client_id uuid references public.clients(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  headcount integer not null default 1,
  pass_type text,
  budget_salary numeric not null default 0,
  target_date date,
  status text not null default 'Open',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid references public.job_requisitions(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  name text not null,
  nationality text,
  phone text,
  email text,
  passport_number text,
  trade text,
  experience_years numeric,
  expected_salary numeric,
  source text not null default 'Direct',
  agent_name text,
  stage text not null default 'Applied',
  interview_date date,
  offer_date date,
  join_date date,
  resume_url text,
  employee_id uuid references public.employees(id) on delete set null,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.job_requisitions to authenticated;
grant all on public.job_requisitions to service_role;
grant select, insert, update, delete on public.candidates to authenticated;
grant all on public.candidates to service_role;

alter table public.job_requisitions enable row level security;
alter table public.candidates enable row level security;

drop policy if exists "staff read requisitions" on public.job_requisitions;
create policy "staff read requisitions" on public.job_requisitions
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

drop policy if exists "staff write requisitions" on public.job_requisitions;
create policy "staff write requisitions" on public.job_requisitions
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

drop policy if exists "staff read candidates" on public.candidates;
create policy "staff read candidates" on public.candidates
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

drop policy if exists "staff write candidates" on public.candidates;
create policy "staff write candidates" on public.candidates
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create index if not exists idx_candidates_requisition on public.candidates(requisition_id);
create index if not exists idx_candidates_stage on public.candidates(stage);
