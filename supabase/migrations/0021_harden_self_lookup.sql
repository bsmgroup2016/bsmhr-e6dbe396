-- Security hardening: my_employee_id() must match on user_id only.
-- Email fallback allowed anyone signing up with a known email to read
-- another person's employee record.
create or replace function public.my_employee_id()
returns uuid language sql stable security definer set search_path to 'public' as $$
  select e.id from public.employees e
  where e.user_id = auth.uid()
  limit 1
$$;

revoke all on function public.my_employee_id() from public;
grant execute on function public.my_employee_id() to authenticated;
