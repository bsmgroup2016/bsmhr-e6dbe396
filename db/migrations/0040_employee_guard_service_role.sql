-- Allow trusted server-side contexts (service role / direct SQL, where auth.uid() is null)
-- to update employee records; the self-update guard only applies to authenticated non-staff users.
create or replace function public.enforce_employee_self_update()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare allowed public.employees%rowtype;
begin
  if auth.uid() is null or is_staff(auth.uid()) then
    return new;
  end if;

  allowed := old;
  allowed.photo_url := new.photo_url;
  allowed.name := coalesce(new.name, old.name);
  allowed.preferred_name := new.preferred_name;
  allowed.nationality := coalesce(new.nationality, old.nationality);
  allowed.date_of_birth := new.date_of_birth;
  allowed.gender := new.gender;
  allowed.marital_status := new.marital_status;
  allowed.phone := new.phone;
  allowed.alt_phone := new.alt_phone;
  allowed.address := new.address;
  allowed.postal_code := new.postal_code;
  allowed.home_country_address := new.home_country_address;
  allowed.emergency_contact := new.emergency_contact;
  allowed.emergency_relation := new.emergency_relation;
  allowed.emergency_phone := new.emergency_phone;
  allowed.emergency_email := new.emergency_email;
  allowed.bank_name := new.bank_name;
  allowed.bank_account := new.bank_account;
  allowed.account_holder_name := new.account_holder_name;
  allowed.passport_number := new.passport_number;
  allowed.passport_expiry := new.passport_expiry;
  if old.status = 'Pending Profile Completion' and new.status = 'Pending Verification' then
    allowed.status := 'Pending Verification';
  end if;
  allowed.updated_at := now();
  return allowed;
end $function$;
