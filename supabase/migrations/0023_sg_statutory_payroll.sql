-- Singapore statutory payroll: CPF profile fields + SDL / SHG fund columns.

alter table public.employees
  add column if not exists ethnic_group text,
  add column if not exists religion text,
  add column if not exists pr_status text;

alter table public.payroll_entries
  add column if not exists sdl numeric(12,2) not null default 0,
  add column if not exists shg_fund text not null default 'None',
  add column if not exists shg_amount numeric(12,2) not null default 0,
  add column if not exists employer_cost numeric(12,2) not null default 0;
