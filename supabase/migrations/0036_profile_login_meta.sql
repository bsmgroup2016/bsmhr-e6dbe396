-- Track last login time + IP for the Users & Permissions page
alter table public.profiles
  add column if not exists last_login_at timestamptz,
  add column if not exists last_login_ip text;
