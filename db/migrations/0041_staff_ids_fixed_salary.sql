-- Office staff use a numeric Employee ID (1000, 1001, ...) instead of a P-File
-- Number, and are paid a fixed monthly salary instead of an hourly basic rate.

create or replace function public.is_staff_designation(_designation text, _department text)
returns boolean language sql immutable as $$
  select case
    when _designation in ('General Worker','Rigal Signal','Rigger Signal','Welder','ForkLift Operator',
                          'Forklift Operator','Lifting Supervisor','Site Supervisor','Electrician',
                          'Plumber','Rebar Man') then false
    when _designation in ('Director','Manager','IT','Engineer','QS','Accounts Head','Accounts Assistant',
                          'Accounts Executive','HR Head','HR Assistant','HR Executive','HR Operation','Driver') then true
    else _department in ('HR','Accounts','QS','IT','Admin')
  end
$$;

-- 1) Renumber office staff sequentially from 1000.
with staff as (
  select id, row_number() over (order by department, trade, name) - 1 as rn
  from public.employees
  where public.is_staff_designation(trade, department)
)
update public.employees e
set employee_code = (1000 + staff.rn)::text
from staff
where e.id = staff.id;

-- 2) Fixed monthly salary by designation; hourly rates do not apply to staff.
update public.employees e
set basic_salary = v.amount,
    payroll_frequency = 'Monthly',
    worker_category = 'Office Staff',
    ot_rate = null
from (values
  ('Director', 12000), ('Manager', 8000), ('Engineer', 5500), ('QS', 5000),
  ('Accounts Head', 6000), ('Accounts Executive', 4000), ('Accounts Assistant', 3000),
  ('HR Head', 6000), ('HR Executive', 4000), ('HR Assistant', 3000), ('HR Operation', 3200),
  ('IT', 4500), ('Driver', 2600)
) as v(trade, amount)
where e.trade = v.trade and public.is_staff_designation(e.trade, e.department);
