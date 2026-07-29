alter table public.companies add column if not exists sector text default 'Construction';
alter table public.employees add column if not exists medical_insurance_expiry date;
alter table public.employees add column if not exists medical_checkup_due date;
alter table public.employees add column if not exists levy_tier text;
