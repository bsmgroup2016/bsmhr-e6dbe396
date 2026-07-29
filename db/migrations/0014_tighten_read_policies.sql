-- Phase: Security hardening — tighten over-permissive SELECT policies
-- Problem: several modules shipped with `for select to authenticated using (true)`,
-- meaning ANY signed-in account (including client_user) could read client rates,
-- invoice amounts, worker leave, safety incidents, dormitory and asset data.
-- Fix: role-scoped read policies built on the existing public.has_role() function.

-- ---------------------------------------------------------------------------
-- 1. Helper predicates (security definer, no recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and role in ('admin', 'manager', 'supervisor')
  )
$$;

create or replace function public.is_manager(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id
      and role in ('admin', 'manager')
  )
$$;

revoke all on function public.is_staff(uuid) from public, anon;
revoke all on function public.is_manager(uuid) from public, anon;
grant execute on function public.is_staff(uuid) to authenticated;
grant execute on function public.is_manager(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Billing — commercially sensitive: admin + manager only
-- ---------------------------------------------------------------------------
drop policy if exists "rates read" on public.rate_agreements;
create policy "rates read" on public.rate_agreements
  for select to authenticated
  using (public.is_manager(auth.uid()));

drop policy if exists "invoices read" on public.invoices;
create policy "invoices read" on public.invoices
  for select to authenticated
  using (public.is_manager(auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. Leave — operational staff only
-- ---------------------------------------------------------------------------
drop policy if exists "leave read" on public.leave_requests;
create policy "leave read" on public.leave_requests
  for select to authenticated
  using (public.is_staff(auth.uid()));

-- ---------------------------------------------------------------------------
-- 4. Accommodation, transport, assets, training, safety — operational staff only
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'dormitories', 'bed_allocations', 'vehicles', 'trips',
    'assets', 'asset_issuances',
    'training_courses', 'training_records', 'safety_incidents'
  ] loop
    execute format('drop policy if exists "%s read" on public.%I', t, t);
    execute format(
      'create policy "%s read" on public.%I for select to authenticated using (public.is_staff(auth.uid()))',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Safety incidents are extra sensitive — restrict writes to admin/manager
--    (already the case, re-asserted here for clarity)
-- ---------------------------------------------------------------------------
drop policy if exists "safety_incidents write" on public.safety_incidents;
create policy "safety_incidents write" on public.safety_incidents
  for all to authenticated
  using (public.is_manager(auth.uid()))
  with check (public.is_manager(auth.uid()));