-- Offline attendance queue: idempotent punch log.
-- The mobile app generates a client_event_id (uuid) per punch and may retry the
-- same punch many times after regaining signal; the unique index makes every
-- retry a no-op instead of a duplicate attendance row.

create table if not exists public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  client_event_id text not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  attendance_id uuid references public.attendance(id) on delete set null,
  kind text not null check (kind in ('checkIn','checkOut')),
  date date not null,
  punched_at timestamptz not null default now(),
  recorded_at timestamptz not null default now(),
  lat double precision,
  lng double precision,
  address text,
  site_id uuid,
  source text not null default 'mobile',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists attendance_events_client_uniq
  on public.attendance_events(employee_id, client_event_id);
create index if not exists attendance_events_emp_date_idx
  on public.attendance_events(employee_id, date);

grant select, insert on public.attendance_events to authenticated;
grant all on public.attendance_events to service_role;
alter table public.attendance_events enable row level security;

drop policy if exists "read own attendance events" on public.attendance_events;
create policy "read own attendance events" on public.attendance_events
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'hr')
    or public.has_role(auth.uid(), 'manager')
    or public.has_role(auth.uid(), 'supervisor')
  );

drop policy if exists "insert own attendance events" on public.attendance_events;
create policy "insert own attendance events" on public.attendance_events
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'hr')
    or public.has_role(auth.uid(), 'manager')
    or public.has_role(auth.uid(), 'supervisor')
  );
