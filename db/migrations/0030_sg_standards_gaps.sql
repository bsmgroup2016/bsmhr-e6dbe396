-- Remaining Singapore standards: MYE + skills upgrade, FWMI coverage,
-- IR21 tax clearance and Progressive Wage Model tracking.

alter table public.employees
  add column if not exists skill_level text,
  add column if not exists skill_cert_type text,
  add column if not exists skill_cert_no text,
  add column if not exists skill_cert_expiry date,
  add column if not exists mye_ref text,
  add column if not exists mye_man_years numeric(8,2),
  add column if not exists insurance_coverage numeric(12,2),
  add column if not exists insurance_insurer text,
  add column if not exists insurance_policy_no text,
  add column if not exists ir21_required boolean,
  add column if not exists ir21_filed_on date,
  add column if not exists ir21_status text,
  add column if not exists ir21_amount_withheld numeric(12,2),
  add column if not exists pwm_sector text,
  add column if not exists pwm_level text;

create index if not exists employees_skill_level_idx on public.employees (skill_level);
create index if not exists employees_ir21_status_idx on public.employees (ir21_status);