-- Step 6: selfie + GPS punch verification.
-- Sites gain an optional geofence; every punch event records the selfie proof,
-- GPS accuracy, distance from site and a verification verdict so HR can audit
-- and flag suspicious punches coming from the mobile apps.

alter table public.sites
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists geofence_radius_m integer not null default 300,
  add column if not exists geofence_enforced boolean not null default false,
  add column if not exists selfie_required boolean not null default false;

alter table public.attendance_events
  add column if not exists selfie_key text,
  add column if not exists accuracy_m double precision,
  add column if not exists distance_m integer,
  add column if not exists geo_status text not null default 'unknown'
    check (geo_status in ('inside','outside','unknown','no_site_geo')),
  add column if not exists verification text not null default 'unverified'
    check (verification in ('verified','flagged','unverified')),
  add column if not exists flags jsonb not null default '[]'::jsonb;

create index if not exists attendance_events_verification_idx
  on public.attendance_events(verification, date desc);

alter table public.attendance
  add column if not exists check_in_selfie_key text,
  add column if not exists check_out_selfie_key text,
  add column if not exists check_in_verification text,
  add column if not exists check_out_verification text,
  add column if not exists check_in_distance_m integer,
  add column if not exists check_out_distance_m integer;

grant select, insert, update on public.attendance_events to authenticated;
grant all on public.attendance_events to service_role;

drop policy if exists "update attendance events staff" on public.attendance_events;
create policy "update attendance events staff" on public.attendance_events
  for update to authenticated
  using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'hr')
    or public.has_role(auth.uid(), 'manager')
    or public.has_role(auth.uid(), 'supervisor')
  )
  with check (true);
