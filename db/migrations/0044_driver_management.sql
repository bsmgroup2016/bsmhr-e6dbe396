-- Driver Management: licences, duty logs, fuel & mileage, traffic/accident records
create table if not exists public.driver_profiles (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null unique references public.employees(id) on delete cascade,
  licence_no text,
  licence_classes text,
  licence_issue_date date,
  licence_expiry date,
  vocational_licence_type text,
  vocational_licence_no text,
  vocational_licence_expiry date,
  years_experience numeric not null default 0,
  demerit_points integer not null default 0,
  assigned_vehicle_id uuid references public.vehicles(id) on delete set null,
  medical_checkup_due date,
  status text not null default 'Active',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_incidents (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  date date not null default current_date,
  incident_type text not null default 'Traffic Offence',
  description text not null default '',
  demerit_points integer not null default 0,
  fine_amount numeric not null default 0,
  paid_by text not null default 'Company',
  status text not null default 'Open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_fuel_logs (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  date date not null default current_date,
  odometer numeric not null default 0,
  litres numeric not null default 0,
  amount numeric not null default 0,
  station text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists driver_incidents_emp_idx on public.driver_incidents(employee_id);
create index if not exists driver_fuel_vehicle_idx on public.driver_fuel_logs(vehicle_id);
create index if not exists driver_fuel_date_idx on public.driver_fuel_logs(date);

grant select, insert, update, delete on public.driver_profiles to authenticated;
grant all on public.driver_profiles to service_role;
grant select, insert, update, delete on public.driver_incidents to authenticated;
grant all on public.driver_incidents to service_role;
grant select, insert, update, delete on public.driver_fuel_logs to authenticated;
grant all on public.driver_fuel_logs to service_role;

alter table public.driver_profiles enable row level security;
alter table public.driver_incidents enable row level security;
alter table public.driver_fuel_logs enable row level security;

do $$
declare t text;
begin
  foreach t in array array['driver_profiles','driver_incidents','driver_fuel_logs'] loop
    execute format('drop policy if exists "%s read" on public.%I', t, t);
    execute format('create policy "%s read" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s write" on public.%I', t, t);
    execute format($f$create policy "%s write" on public.%I for all to authenticated
      using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'hr'))
      with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'hr'))$f$, t, t);
  end loop;
end $$;
