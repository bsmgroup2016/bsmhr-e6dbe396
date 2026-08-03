-- Seed demo transport data: assign drivers to vehicles and generate trips
-- across a 30-day window so the Fleet calendar/filters have data to show.

-- 1) Attach a driver (same company when possible) to every vehicle
update public.vehicles v
set driver_employee_id = d.id,
    updated_at = now()
from (
  select e.id, e.company_id,
         row_number() over (partition by e.company_id order by e.name) as rn
  from public.employees e
  where e.trade ilike '%driver%' or e.worker_category = 'Driver'
) d
where v.driver_employee_id is null
  and d.company_id = v.company_id
  and d.rn = 1;

update public.vehicles v
set driver_employee_id = (
  select e.id from public.employees e
  where e.trade ilike '%driver%' or e.worker_category = 'Driver'
  order by e.name limit 1
)
where v.driver_employee_id is null;

-- 2) Generate trips (idempotent: skip if trips already seeded)
insert into public.trips (vehicle_id, driver_employee_id, site_id, date, departure_time, return_time, route, passengers, status, notes)
select
  v.id,
  v.driver_employee_id,
  s.id,
  d::date,
  sh.dep,
  sh.ret,
  r.route,
  case when v.capacity > 0 then greatest(3, (v.capacity - ((extract(day from d)::int + sh.idx) % 4))) else 12 end,
  case
    when d::date < current_date then 'Completed'
    when d::date = current_date then 'In Progress'
    else 'Scheduled'
  end,
  'Demo data'
from public.vehicles v
cross join generate_series(current_date - interval '18 days', current_date + interval '10 days', interval '1 day') d
cross join (values (0,'06:00','18:30'), (1,'13:00','22:00')) as sh(idx, dep, ret)
cross join lateral (
  select id from public.sites
  order by md5(id::text || v.id::text || d::text)
  limit 1
) s
cross join lateral (
  select (array[
    'Kranji Dorm → Jurong Site',
    'Woodlands Dorm → Tuas Site',
    'Changi Airport → Kaki Bukit Dorm',
    'Sungei Kadut Dorm → CBD Project',
    'Mandai Dorm → Sembawang Yard'
  ])[1 + (abs(hashtext(v.plate_no || d::text || sh.idx::text)) % 5)] as route
) r
where extract(dow from d) <> 0
  and (abs(hashtext(v.plate_no || d::text || sh.idx::text)) % 10) < 7
  and not exists (select 1 from public.trips t where t.notes = 'Demo data');
