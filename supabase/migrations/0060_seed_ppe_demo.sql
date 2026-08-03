-- Demo PPE / asset register + issuance history
insert into public.assets (company_id, asset_code, name, category, brand, quantity, unit_cost, purchase_date, warranty_expiry, calibration_due, location, status, reissue_months, min_stock, remarks)
select c.id,
       'AST-' || upper(left(c.name,3)) || '-' || lpad(t.n::text,3,'0'),
       t.name, t.cat, t.brand, t.qty, t.cost,
       current_date - (t.n * 25),
       case when t.warranty then current_date + (t.n * 40) else null end,
       case when t.calib then current_date + (t.n * 15 - 20) else null end,
       t.loc, 'Available', t.reissue, t.minstock, t.remarks
from public.companies c
cross join (values
  (1,'Safety Helmet (White)','PPE','3M',120,14.50,'Store Rack A1',24,20,false,false,'Site supervisors'),
  (2,'Safety Helmet (Yellow)','PPE','3M',260,12.00,'Store Rack A1',24,40,false,false,'General workers'),
  (3,'Safety Shoes','PPE','King''s',180,42.00,'Store Rack A2',12,30,false,false,'Steel toe cap'),
  (4,'Reflective Vest','PPE','Local',300,6.50,'Store Rack A3',12,50,false,false,null),
  (5,'Full Body Harness','PPE','Miller',60,145.00,'Store Rack B1',36,10,true,true,'Annual inspection required'),
  (6,'Safety Goggles','PPE','Uvex',200,8.00,'Store Rack A4',12,40,false,false,null),
  (7,'Ear Muffs','PPE','3M',90,18.00,'Store Rack A4',24,15,false,false,null),
  (8,'Welding Mask','PPE','ESAB',35,95.00,'Store Rack B2',24,6,false,false,'For welders only'),
  (9,'Cut Resistant Gloves','PPE','Ansell',400,4.20,'Store Rack A5',3,80,false,false,'Monthly replacement'),
  (10,'Dust Mask N95','PPE','3M',500,1.80,'Store Rack A5',1,100,false,false,'Consumable'),
  (11,'Gas Detector','Equipment','Honeywell',12,680.00,'Safety Office',0,2,true,true,'6-monthly calibration'),
  (12,'Torque Wrench','Tool','Stanley',18,220.00,'Tool Crib',0,3,true,true,'Yearly calibration'),
  (13,'Angle Grinder','Tool','Bosch',25,180.00,'Tool Crib',0,5,true,false,null),
  (14,'Scaffold Spanner','Tool','Local',60,15.00,'Tool Crib',0,10,false,false,null),
  (15,'Site Laptop','IT','Dell',8,1450.00,'Admin Office',0,1,true,false,'Engineer use')
) as t(n,name,cat,brand,qty,cost,loc,reissue,minstock,warranty,calib,remarks);

-- Issuance history: each site worker gets core PPE, plus trade specific items
with workers as (
  select e.id as employee_id, e.company_id,
         row_number() over (partition by e.company_id order by e.created_at, e.id) as rn,
         e.trade
  from public.employees e
  where e.company_id is not null
),
items as (
  select a.id as asset_id, a.company_id, a.name, a.unit_cost, a.reissue_months
  from public.assets a
  where a.category = 'PPE'
),
staff as (
  select distinct on (company_id) company_id, employee_id from workers order by company_id, rn
)
insert into public.asset_issuances
  (asset_id, employee_id, site_id, quantity, issue_date, due_date, replacement_due,
   condition_out, condition_in, return_date, status, size, issued_by, receipt_no,
   acknowledged, ack_date, cost_recovery, deduct_from_salary, remarks)
select i.asset_id,
       w.employee_id,
       (select s.id from public.sites s order by md5(s.id::text || w.employee_id::text) limit 1),
       case when i.name like 'Dust Mask%' then 5 when i.name like '%Gloves%' then 2 else 1 end,
       d.issue_date,
       case when i.name in ('Full Body Harness','Welding Mask') then d.issue_date + 180 else null end,
       case when i.reissue_months > 0 then d.issue_date + (i.reissue_months * 30)::int else null end,
       'New',
       case when d.returned then 'Fair' else null end,
       case when d.returned then d.issue_date + 120 else null end,
       case when d.returned then 'Returned' when (w.rn + length(i.name)) % 23 = 0 then 'Lost' else 'Issued' end,
       case when i.name like '%Shoes%' then (array['39','40','41','42','43','44'])[1 + (w.rn % 6)]
            when i.name like '%Vest%' or i.name like '%Gloves%' then (array['M','L','XL'])[1 + (w.rn % 3)]
            else null end,
       (array['Store Keeper — Rahman','Safety Officer — Kumar','HR Assistant — Siti'])[1 + (w.rn % 3)],
       'PPE-' || lpad(((w.rn * 7 + length(i.name)) % 9999)::text, 4, '0'),
       (w.rn % 7) <> 0,
       case when (w.rn % 7) <> 0 then d.issue_date else null end,
       case when (w.rn + length(i.name)) % 23 = 0 then i.unit_cost else 0 end,
       (w.rn + length(i.name)) % 23 = 0,
       case when (w.rn + length(i.name)) % 23 = 0 then 'Reported lost on site — cost recovered from salary' else null end
from workers w
join items i on i.company_id = w.company_id
cross join lateral (
  select (current_date - ((w.rn * 3 + length(i.name)) % 240)::int)::date as issue_date,
         ((w.rn + length(i.name)) % 11 = 0) as returned
) d
where i.name in ('Safety Helmet (Yellow)','Safety Shoes','Reflective Vest','Cut Resistant Gloves','Dust Mask N95','Safety Goggles')
   or (i.name = 'Welding Mask' and lower(coalesce(w.trade,'')) like '%weld%')
   or (i.name = 'Full Body Harness' and w.rn % 5 = 0)
   or (i.name = 'Ear Muffs' and w.rn % 4 = 0);
