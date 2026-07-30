alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_key text;
create unique index if not exists profiles_username_key on public.profiles (lower(username)) where username is not null;
