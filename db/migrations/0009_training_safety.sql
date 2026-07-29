create table if not exists public.training_courses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  code text not null default '',
  name text not null,
  category text not null default 'Safety',
  provider text,
  validity_months integer,
  mandatory boolean not null default false,
  cost numeric not null default 0,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_records (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.training_courses(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  completion_date date,
  expiry_date date,
  certificate_no text,
  score numeric,
  cost numeric,
  status text not null default 'Completed',
  document_url text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.safety_incidents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  incident_date date not null default current_date,
  incident_type text not null default 'Near Miss',
  severity text not null default 'Low',
  description text not null default '',
  action_taken text,
  mom_reported boolean not null default false,
  lost_days integer not null default 0,
  status text not null default 'Open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists training_records_emp_idx on public.training_records(employee_id);
create index if not exists training_records_course_idx on public.training_records(course_id);
create index if not exists safety_incidents_company_idx on public.safety_incidents(company_id);

grant select, insert, update, delete on public.training_courses to authenticated;
grant all on public.training_courses to service_role;
grant select, insert, update, delete on public.training_records to authenticated;
grant all on public.training_records to service_role;
grant select, insert, update, delete on public.safety_incidents to authenticated;
grant all on public.safety_incidents to service_role;

alter table public.training_courses enable row level security;
alter table public.training_records enable row level security;
alter table public.safety_incidents enable row level security;

do $$
declare t text;
begin
  foreach t in array array['training_courses','training_records','safety_incidents'] loop
    execute format('drop policy if exists "%s read" on public.%I', t, t);
    execute format('create policy "%s read" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s write" on public.%I', t, t);
    execute format($f$create policy "%s write" on public.%I for all to authenticated
      using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
      with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))$f$, t, t);
  end loop;
end $$;