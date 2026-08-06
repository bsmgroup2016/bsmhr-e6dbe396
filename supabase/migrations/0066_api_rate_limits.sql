-- Rate limiting for the mobile/public API v1.
-- The server runtime is stateless (workers), so counters live in Postgres.
-- Fixed-window counter: one row per (bucket, window_start).

create table if not exists public.api_rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket, window_start)
);

create index if not exists api_rate_limits_window_idx
  on public.api_rate_limits(window_start);

alter table public.api_rate_limits enable row level security;
-- No policies: reachable only through the security-definer function below.
revoke all on public.api_rate_limits from anon, authenticated;
grant all on public.api_rate_limits to service_role;

create or replace function public.api_rate_limit(
  _bucket text,
  _limit integer,
  _window_seconds integer
)
returns table (allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  w timestamptz;
  c integer;
begin
  if _limit is null or _limit <= 0 then _limit := 60; end if;
  if _window_seconds is null or _window_seconds <= 0 then _window_seconds := 60; end if;

  w := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds);

  insert into public.api_rate_limits (bucket, window_start, count)
  values (left(coalesce(_bucket, 'unknown'), 200), w, 1)
  on conflict (bucket, window_start)
  do update set count = public.api_rate_limits.count + 1
  returning public.api_rate_limits.count into c;

  -- opportunistic cleanup of stale windows
  if random() < 0.01 then
    delete from public.api_rate_limits where window_start < now() - interval '2 hours';
  end if;

  return query select c <= _limit, greatest(_limit - c, 0), w + make_interval(secs => _window_seconds);
end;
$$;

revoke all on function public.api_rate_limit(text, integer, integer) from public;
grant execute on function public.api_rate_limit(text, integer, integer) to authenticated, anon, service_role;
