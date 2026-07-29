-- Role hierarchy: admin inherits everything, hr inherits manager+supervisor.
-- New enum values are added in a separate transaction (see 0017a below).
-- ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hr';
-- ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'employee';

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = _user_id
      and (
        ur.role = _role
        -- admin has full control over every capability
        or ur.role = 'admin'
        -- HR has the same operational reach as a manager
        or (ur.role = 'hr' and _role in ('manager','supervisor'))
        -- managers cover supervisor-level capabilities
        or (ur.role = 'manager' and _role = 'supervisor')
      )
  );
$$;

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
      and role in ('admin','manager','hr','supervisor')
  )
$$;
