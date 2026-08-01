-- Task types (airport worker pickup etc.) + expected duration for availability ETA
alter table public.driver_tasks
  add column if not exists task_type text not null default 'Worker transport',
  add column if not exists flight_no text,
  add column if not exists terminal text,
  add column if not exists arriving_workers text,
  add column if not exists expected_minutes integer not null default 60;

update public.driver_tasks set task_type = 'Worker transport' where task_type is null;
