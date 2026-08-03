alter table public.smtp_settings
  add column if not exists max_attempts integer not null default 3,
  add column if not exists retry_delay_ms integer not null default 1000,
  add column if not exists backoff_multiplier numeric not null default 2,
  add column if not exists failover_enabled boolean not null default true,
  add column if not exists switch_back boolean not null default true;
