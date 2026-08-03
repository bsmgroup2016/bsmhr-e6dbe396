-- PPE issuance detail: who took it, when, size, acknowledgement, cost recovery
alter table public.assets
  add column if not exists reissue_months integer not null default 0,
  add column if not exists min_stock integer not null default 0;

alter table public.asset_issuances
  add column if not exists size text,
  add column if not exists issued_by text,
  add column if not exists receipt_no text,
  add column if not exists acknowledged boolean not null default false,
  add column if not exists ack_date date,
  add column if not exists ack_signature_url text,
  add column if not exists replacement_due date,
  add column if not exists cost_recovery numeric not null default 0,
  add column if not exists deduct_from_salary boolean not null default false;

create index if not exists asset_issuances_issue_date_idx on public.asset_issuances(issue_date);
