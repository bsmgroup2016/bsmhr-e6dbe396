-- Demo attendance for site workers: last 30 days, OT 0/1/2h, some absences,
-- Sundays off except a small group who work Sundays (with OT).
with workers as (
  select e.id,
         row_number() over (order by e.employee_code) as rn
  from public.employees e
  where e.company_id is not null
    and coalesce(e.status,'Active') <> 'Inactive'
    and (
      lower(coalesce(e.department,'')) = 'construction'
      or lower(coalesce(e.trade,'')) in (
        'general worker','rigal signal','rigger signal','welder','forklift operator',
        'lifting supervisor','site supervisor','electrician','plumber','rebar man'
      )
    )
), days as (
  select (current_date - offs)::date as d, offs
  from generate_series(1, 30) as offs
), grid as (
  select w.id, w.rn, d.d, d.offs,
         extract(dow from d.d) = 0 as is_sunday,
         ((w.rn * 7 + d.offs * 13) % 100) as roll,
         ((w.rn * 3 + d.offs * 5) % 10) as ot_roll
  from workers w cross join days d
), rows as (
  select id, d, is_sunday, roll, ot_roll,
         -- only every 6th worker works Sundays
         (is_sunday and (rn % 6) <> 0) as skip_day,
         case
           when roll < 7 then 'Absent'
           when roll between 7 and 9 then 'On Leave'
           else 'Present'
         end as status
  from grid
)
insert into public.attendance (employee_id, date, status, check_in, check_out, hours_worked, overtime_hours, source, notes)
select r.id,
       r.d,
       r.status::attendance_status,
       case when r.status = 'Present' then time '08:00' end,
       case when r.status = 'Present' then (time '17:00' + (case when r.ot_roll < 4 then 0 when r.ot_roll < 7 then 1 else 2 end) * interval '1 hour')::time end,
       case when r.status = 'Present' then 8 else 0 end,
       case when r.status = 'Present' then (case when r.ot_roll < 4 then 0 when r.ot_roll < 7 then 1 else 2 end) else 0 end,
       'demo',
       case when r.is_sunday then 'Sunday duty' end
from rows r
where not r.skip_day
on conflict (employee_id, date) do nothing;
