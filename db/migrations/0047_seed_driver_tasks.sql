delete from public.driver_tasks;
insert into public.driver_tasks (company_id, driver_employee_id, vehicle_id, site_id, title, instruction, pickup, dropoff, passengers, scheduled_at, status, status_updated_at, driver_note, last_lat, last_lng, last_location_at)
select e.company_id, e.id,
  (select v.id from public.vehicles v where v.company_id = e.company_id limit 1),
  (select s.id from public.sites s order by random() limit 1),
  t.title, t.instruction, t.pickup, t.dropoff, t.pax,
  current_date + t.at, t.status, now() - (t.mins || ' minutes')::interval, t.note,
  t.lat, t.lng, case when t.lat is null then null else now() - interval '2 minutes' end
from public.employees e
cross join (values
  ('Morning worker transport','Pick 14 workers from Kaki Bukit dorm, drop at site gate B by 7:30 AM. Sign the gate pass.','Kaki Bukit Dorm','Site Gate B',14, time '06:30', 'Workers dropped off', 95, 'All 14 dropped at 7:22 AM', 1.3352, 103.9010),
  ('Material run — hardware store','Collect scaffold clamps from supplier, bring to site store. Keep the invoice.','Sungei Kadut Supplier','Site Store',0, time '10:00', 'En route to pickup', 12, null, 1.4143, 103.7500),
  ('Evening return trip','Pick workers from site at 6:00 PM, drop back at dorm. Head office after that.','Site Gate B','Kaki Bukit Dorm',14, time '18:00', 'Assigned', 5, null, null, null)
) as t(title,instruction,pickup,dropoff,pax,at,status,mins,note,lat,lng)
where e.trade ilike '%driver%';
select status, count(*) from public.driver_tasks group by status;
