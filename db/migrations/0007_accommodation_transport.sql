-- Phase 7: Accommodation & Transport
create table if not exists public.dormitories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  name text not null,
  address text not null default '',
  operator text,
  contact_person text,
  contact_phone text,
  capacity integer not null default 0,
  monthly_rent numeric not null default 0,
  license_no text,
  license_expiry date,
  last_inspection date,
  status text not null default 'Active',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.bed_allocations (
  id uuid primary key default gen_random_uuid(),
  dormitory_id uuid not null references public.dormitories(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  room_no text not null default '',
  bed_no text,
  check_in_date date,
  check_out_date date,
  monthly_rent numeric not null default 0,
  status text not null default 'Occupied',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  plate_no text not null,
  vehicle_type text not null default 'Lorry',
  make_model text,
  capacity integer not null default 0,
  driver_employee_id uuid references public.employees(id) on delete set null,
  road_tax_expiry date,
  insurance_expiry date,
  inspection_due date,
  status text not null default 'Active',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  driver_employee_id uuid references public.employees(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  date date not null default current_date,
  departure_time text,
  return_time text,
  route text,
  passengers integer not null default 0,
  status text not null default 'Scheduled',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bed_allocations_dorm_idx on public.bed_allocations(dormitory_id);
create index if not exists bed_allocations_emp_idx on public.bed_allocations(employee_id);
create unique index if not exists vehicles_plate_idx on public.vehicles(plate_no);
create index if not exists trips_vehicle_idx on public.trips(vehicle_id);
create index if not exists trips_date_idx on public.trips(date);

grant select, insert, update, delete on public.dormitories to authenticated;
grant all on public.dormitories to service_role;
grant select, insert, update, delete on public.bed_allocations to authenticated;
grant all on public.bed_allocations to service_role;
grant select, insert, update, delete on public.vehicles to authenticated;
grant all on public.vehicles to service_role;
grant select, insert, update, delete on public.trips to authenticated;
grant all on public.trips to service_role;

alter table public.dormitories enable row level security;
alter table public.bed_allocations enable row level security;
alter table public.vehicles enable row level security;
alter table public.trips enable row level security;

do $$
declare t text;
begin
  foreach t in array array['dormitories','bed_allocations','vehicles','trips'] loop
    execute format('drop policy if exists "%s read" on public.%I', t, t);
    execute format('create policy "%s read" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s write" on public.%I', t, t);
    execute format($f$create policy "%s write" on public.%I for all to authenticated
      using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
      with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))$f$, t, t);
  end loop;
end $$;