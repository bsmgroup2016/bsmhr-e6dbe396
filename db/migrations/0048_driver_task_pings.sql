-- GPS breadcrumb trail for each driver task (route replay + fraud detection)
create table if not exists public.driver_task_pings (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.driver_tasks(id) on delete cascade,
  driver_employee_id uuid not null references public.employees(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  status text,
  speed_kmh numeric,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists driver_task_pings_task_idx on public.driver_task_pings(task_id, recorded_at);
create index if not exists driver_task_pings_driver_idx on public.driver_task_pings(driver_employee_id, recorded_at);

grant select, insert, update, delete on public.driver_task_pings to authenticated;
grant all on public.driver_task_pings to service_role;

alter table public.driver_task_pings enable row level security;

drop policy if exists "driver_task_pings read" on public.driver_task_pings;
create policy "driver_task_pings read" on public.driver_task_pings
  for select to authenticated using (true);

drop policy if exists "driver_task_pings write" on public.driver_task_pings;
create policy "driver_task_pings write" on public.driver_task_pings
  for all to authenticated using (true) with check (true);
