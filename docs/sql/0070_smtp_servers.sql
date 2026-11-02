create table if not exists public.smtp_servers (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  host text not null,
  port int not null default 587,
  secure boolean not null default false,
  username text,
  password text,
  from_email text not null,
  from_name text,
  priority int not null default 1,
  enabled boolean not null default true,
  daily_limit int,
  sent_today int not null default 0,
  sent_day date,
  cooldown_until timestamptz,
  last_error text,
  last_used_at timestamptz,
  updated_at timestamptz not null default now()
);
grant all on public.smtp_servers to service_role;
revoke all on public.smtp_servers from anon, authenticated;
alter table public.smtp_servers enable row level security;
insert into public.smtp_servers (label,host,port,secure,username,password,from_email,from_name,enabled)
select 'SMTP 1',host,coalesce(port,587),secure,username,password,from_email,from_name,enabled
from public.smtp_settings where id=1 and host is not null and from_email is not null
and not exists (select 1 from public.smtp_servers);
