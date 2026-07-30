-- Organisation master data: departments and designations per company.
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  code text not null default '',
  name text not null,
  description text,
  head_employee_id uuid references public.employees(id) on delete set null,
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.designations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  code text not null default '',
  title text not null,
  level text,
  description text,
  status text not null default 'Active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists departments_company_idx on public.departments(company_id);
create index if not exists designations_company_idx on public.designations(company_id);
create index if not exists designations_department_idx on public.designations(department_id);

grant select, insert, update, delete on public.departments to authenticated;
grant all on public.departments to service_role;
grant select, insert, update, delete on public.designations to authenticated;
grant all on public.designations to service_role;

alter table public.departments enable row level security;
alter table public.designations enable row level security;

drop policy if exists "staff read departments" on public.departments;
create policy "staff read departments" on public.departments for select to authenticated using (true);

drop policy if exists "staff write departments" on public.departments;
create policy "staff write departments" on public.departments for all to authenticated
using (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'hr'::app_role))
with check (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'hr'::app_role));

drop policy if exists "staff read designations" on public.designations;
create policy "staff read designations" on public.designations for select to authenticated using (true);

drop policy if exists "staff write designations" on public.designations;
create policy "staff write designations" on public.designations for all to authenticated
using (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'hr'::app_role))
with check (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'hr'::app_role));
