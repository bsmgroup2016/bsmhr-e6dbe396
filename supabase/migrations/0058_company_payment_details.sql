-- Manual PayNow / Bank Transfer payment details per company (no gateway required).
alter table public.companies
  add column if not exists paynow_type text default 'UEN',
  add column if not exists paynow_uen text,
  add column if not exists paynow_phone text,
  add column if not exists paynow_editable boolean default false,
  add column if not exists bank_name text,
  add column if not exists bank_account_name text,
  add column if not exists bank_account_no text,
  add column if not exists bank_code text,
  add column if not exists bank_swift text,
  add column if not exists payment_instructions text;
