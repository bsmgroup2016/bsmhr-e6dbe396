create or replace function public.enforce_employee_self_update()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare new_photo text;
begin
  if is_staff(auth.uid()) then
    return new;
  end if;
  new_photo := new.photo_url;
  new := old;
  new.photo_url := new_photo;
  new.updated_at := now();
  return new;
end $$;
