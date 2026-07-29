-- Recruitment agent commission tracking + MOM dormitory space standard
alter table public.candidates
  add column if not exists agent_commission numeric default 0,
  add column if not exists commission_status text default 'Unbilled',
  add column if not exists commission_paid_on date;

alter table public.dormitories
  add column if not exists floor_area_sqm numeric default 0,
  add column if not exists rooms integer default 0;
