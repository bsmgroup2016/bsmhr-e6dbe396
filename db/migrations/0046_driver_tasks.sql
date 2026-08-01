create table if not exists public.driver_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  driver_employee_id uuid not null references public.employees(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  site_id uuid references public.sites(id) on delete set null,
  title text not null default 'Worker transport',
  instruction text not null default '',
  pickup text,
  dropoff text,
  passengers integer not null default 0,
  scheduled_at timestamptz not null default now(),
  status text not null default 'Assigned',
  status_updated_at timestamptz not null default now(),
  driver_note text,
  last_lat double precision,
  last_lng double precision,
  last_location_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists driver_tasks_driver_idx on public.driver_tasks(driver_employee_id);
create index if not exists driver_tasks_status_idx on public.driver_tasks(status);

grant select, insert, update, delete on public.driver_tasks to authenticated;
grant all on public.driver_tasks to service_role;
alter table public.driver_tasks enable row level security;
drop policy if exists "driver_tasks read" on public.driver_tasks;
create policy "driver_tasks read" on public.driver_tasks for select to authenticated using (true);
drop policy if exists "driver_tasks write" on public.driver_tasks;
create policy "driver_tasks write" on public.driver_tasks for all to authenticated using (true) with check (true);
