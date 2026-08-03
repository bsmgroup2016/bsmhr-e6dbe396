create table if not exists public.smtp_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,
  primary_provider text not null default 'resend' check (primary_provider in ('resend','smtp')),
  host text,
  port integer default 587,
  secure boolean not null default false,
  username text,
  password text,
  from_email text,
  from_name text,
  updated_at timestamptz not null default now()
);
grant all on public.smtp_settings to service_role;
alter table public.smtp_settings enable row level security;
insert into public.smtp_settings (id) values (1) on conflict (id) do nothing;
