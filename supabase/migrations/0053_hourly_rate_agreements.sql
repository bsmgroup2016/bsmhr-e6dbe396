-- Convert demo designation rates from Daily to Hourly with realistic per-hour pricing.
update public.rate_agreements set
  unit = 'Hourly',
  normal_rate = case
    when trade in ('General Worker','Cleaner','Helper') then 9
    when trade in ('Scaffolder','Rigger','Painter','Rebar Man','Driver') then 10
    when trade in ('Welder','Pipe Fitter','Supervisor','Electrician','Site Engineer') then 13
    else 10
  end,
  ot_rate = case
    when trade in ('General Worker','Cleaner','Helper') then 13.50
    when trade in ('Scaffolder','Rigger','Painter','Rebar Man','Driver') then 15.00
    when trade in ('Welder','Pipe Fitter','Supervisor','Electrician','Site Engineer') then 19.50
    else 15.00
  end,
  updated_at = now()
where remarks = 'Demo rate agreement' or unit = 'Daily';
