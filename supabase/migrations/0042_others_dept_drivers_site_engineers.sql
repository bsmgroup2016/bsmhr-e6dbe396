-- Others department becomes global; move site engineers to the worker roster;
-- seed drivers under Others.
update public.departments set company_id = null where name = 'Others';

insert into public.departments (name, status)
select 'Others', 'Active'
where not exists (select 1 from public.departments where name = 'Others');

update public.designations d
   set department_id = (select id from public.departments where name = 'Others' and company_id is null limit 1)
 where d.title = 'Driver';

-- Construction-department engineers move to Employee/Workers with P-File numbers
with prefixed as (
  select e.id,
         case c.code when 'BSM' then 'BS' when 'VRL' then 'V' else 'P' end as pfx,
         row_number() over (partition by e.company_id order by e.employee_code) as rn
    from public.employees e
    join public.companies c on c.id = e.company_id
   where e.department = 'Construction' and e.trade = 'Engineer'
     and e.employee_code ~ '^[0-9]+$'
), nextnum as (
  select p.id, p.pfx,
         (select coalesce(max((regexp_replace(e2.employee_code, '^[A-Z]+-', ''))::int), 0)
            from public.employees e2
           where e2.employee_code ~ ('^' || p.pfx || '-[0-9]+$')) + p.rn as num
    from prefixed p
)
update public.employees e
   set employee_code = n.pfx || '-' || lpad(n.num::text, 2, '0')
  from nextnum n
 where e.id = n.id;

-- Drivers (office staff, Others department, fixed monthly salary)
insert into public.employees (employee_code, name, company_id, department, trade, job_title,
  nationality, status, basic_salary, payroll_frequency, employment_type, passport_number, passport_expiry)
values
  ('1067', 'Mohammed Selim', (select id from public.companies where code='BSM'), 'Others', 'Driver', 'Driver',
   'Bangladeshi', 'Active', 2600, 'Monthly', 'Full-time', 'BX7741220', '2029-03-18'),
  ('1068', 'Ramesh Kumar', (select id from public.companies where code='VRL'), 'Others', 'Driver', 'Driver',
   'Indian', 'Active', 2500, 'Monthly', 'Full-time', 'Z6612884', '2028-11-04'),
  ('1069', 'Tan Wei Ming', (select id from public.companies where code='PLT'), 'Others', 'Driver', 'Driver',
   'Singaporean', 'Active', 2800, 'Monthly', 'Full-time', 'K3390142M', '2030-06-22')
on conflict do nothing;
