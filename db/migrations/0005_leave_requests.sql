-- Phase 5: Leave management
create table if not exists public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  leave_type text not null default 'Annual Leave',
  start_date date not null,
  end_date date not null,
  days numeric not null default 0,
  reason text,
  status text not null default 'Pending',
  approved_by uuid,
  approved_at timestamptz,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists leave_requests_employee_idx on public.leave_requests(employee_id);
create index if not exists leave_requests_status_idx on public.leave_requests(status);

grant select, insert, update, delete on public.leave_requests to authenticated;
grant all on public.leave_requests to service_role;

alter table public.leave_requests enable row level security;

drop policy if exists "leave read" on public.leave_requests;
create policy "leave read" on public.leave_requests
  for select to authenticated using (true);

drop policy if exists "leave write" on public.leave_requests;
create policy "leave write" on public.leave_requests
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'supervisor'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'supervisor'));
