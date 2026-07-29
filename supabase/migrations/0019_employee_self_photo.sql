-- Employees may update ONLY their own profile photo; everything else is HR/admin.
create or replace function public.enforce_employee_self_update()
returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  if is_staff(auth.uid()) then
    return new;
  end if;
  -- non-staff: only the photo may change on their own row
  if new.id is distinct from old.id then raise exception 'Not allowed'; end if;
  new := old;
  new.photo_url := (select photo_url from (select new.photo_url) t);
  return new;
end $$;

drop trigger if exists employee_self_update_guard on public.employees;
create trigger employee_self_update_guard
before update on public.employees
for each row execute function public.enforce_employee_self_update();

do $$ begin
  if not exists (select 1 from pg_policies where tablename='employees' and policyname='update_self_photo_employees') then
    create policy update_self_photo_employees on public.employees for update to authenticated
      using (id = my_employee_id()) with check (id = my_employee_id());
  end if;
end $$;
