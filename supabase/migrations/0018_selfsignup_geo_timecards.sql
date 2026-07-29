-- Phase: self-signup, branch prefixes, certifications, GPS attendance, time cards, claim sheets

-- 1. employee_status enum completion
do $$ declare v text;
begin
  foreach v in array array['Draft','Pending Approval','Pending Profile Completion','Suspended','Resigned','Terminated','Repatriated','Archived']
  loop
    if not exists (select 1 from pg_enum e join pg_type t on t.oid=e.enumtypid
                   where t.typname='employee_status' and e.enumlabel=v) then
      execute format('alter type employee_status add value %L', v);
    end if;
  end loop;
end $$;

-- 2. employees: link to auth user + extra fields
alter table public.employees
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists work_permit_issue_date date,
  add column if not exists work_permit_expiry_date date,
  add column if not exists dormitory_address text,
  add column if not exists account_holder_name text;
create unique index if not exists employees_user_id_key on public.employees(user_id) where user_id is not null;
create unique index if not exists employees_employee_code_key on public.employees(lower(employee_code));

create or replace function public.my_employee_id()
returns uuid language sql stable security definer set search_path to 'public' as $$
  select e.id from public.employees e
  where e.user_id = auth.uid()
     or lower(e.email) = lower(coalesce(auth.jwt() ->> 'email',''))
  order by (e.user_id = auth.uid()) desc
  limit 1
$$;

-- 3. branch prefixes (configurable employee-ID sequences)
create table if not exists public.branch_prefixes (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  company_id uuid references public.companies(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists branch_prefixes_code_key on public.branch_prefixes(upper(code));
grant select on public.branch_prefixes to authenticated;
grant all on public.branch_prefixes to service_role;
alter table public.branch_prefixes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='branch_prefixes' and policyname='read_branch_prefixes') then
    create policy read_branch_prefixes on public.branch_prefixes for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='branch_prefixes' and policyname='write_admin_branch_prefixes') then
    create policy write_admin_branch_prefixes on public.branch_prefixes for all to authenticated
      using (has_role(auth.uid(),'admin')) with check (has_role(auth.uid(),'admin'));
  end if;
end $$;
grant insert, update, delete on public.branch_prefixes to authenticated;

insert into public.branch_prefixes (code, name)
select v.code, v.name from (values ('BS','BSM Engineering'),('V','VRL'),('P','Pluto'),('X','Unassigned')) as v(code,name)
where not exists (select 1 from public.branch_prefixes b where upper(b.code)=upper(v.code));

-- 4. certifications
create table if not exists public.employee_certifications (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  course_name text not null,
  issuing_body text,
  issue_date date,
  expiry_date date,
  file_url text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.employee_certifications to authenticated;
grant all on public.employee_certifications to service_role;
alter table public.employee_certifications enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='employee_certifications' and policyname='read_certs') then
    create policy read_certs on public.employee_certifications for select to authenticated
      using (is_staff(auth.uid()) or employee_id = my_employee_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='employee_certifications' and policyname='write_certs') then
    create policy write_certs on public.employee_certifications for all to authenticated
      using (has_role(auth.uid(),'manager')) with check (has_role(auth.uid(),'manager'));
  end if;
end $$;

-- 5. attendance geo
alter table public.attendance
  add column if not exists check_in_lat numeric,
  add column if not exists check_in_lng numeric,
  add column if not exists check_in_address text,
  add column if not exists check_out_lat numeric,
  add column if not exists check_out_lng numeric,
  add column if not exists check_out_address text;

-- 6. time cards
create table if not exists public.time_cards (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  file_url text,
  file_name text,
  status text not null default 'Draft',
  entries jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.time_cards to authenticated;
grant all on public.time_cards to service_role;
alter table public.time_cards enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='time_cards' and policyname='read_time_cards') then
    create policy read_time_cards on public.time_cards for select to authenticated
      using (is_staff(auth.uid()) or employee_id = my_employee_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='time_cards' and policyname='write_time_cards') then
    create policy write_time_cards on public.time_cards for all to authenticated
      using (has_role(auth.uid(),'manager')) with check (has_role(auth.uid(),'manager'));
  end if;
end $$;

-- 7. claim sheets
create table if not exists public.claim_sheets (
  id uuid primary key default gen_random_uuid(),
  reference text not null,
  employee_id uuid references public.employees(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  period_start date not null,
  period_end date not null,
  total_days numeric not null default 0,
  total_normal_hours numeric not null default 0,
  total_ot_hours numeric not null default 0,
  snapshot jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.claim_sheets to authenticated;
grant all on public.claim_sheets to service_role;
alter table public.claim_sheets enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='claim_sheets' and policyname='read_claim_sheets') then
    create policy read_claim_sheets on public.claim_sheets for select to authenticated
      using (is_staff(auth.uid()) or employee_id = my_employee_id());
  end if;
  if not exists (select 1 from pg_policies where tablename='claim_sheets' and policyname='write_claim_sheets') then
    create policy write_claim_sheets on public.claim_sheets for all to authenticated
      using (has_role(auth.uid(),'manager')) with check (has_role(auth.uid(),'manager'));
  end if;
end $$;
