-- Quotations for brand-new / prospect clients (no client record yet)
alter table public.quotations alter column client_id drop not null;
alter table public.quotations add column if not exists prospect_company text;
alter table public.quotations add column if not exists prospect_contact text;
alter table public.quotations add column if not exists prospect_email text;
alter table public.quotations add column if not exists prospect_phone text;
alter table public.quotations add column if not exists prospect_address text;
