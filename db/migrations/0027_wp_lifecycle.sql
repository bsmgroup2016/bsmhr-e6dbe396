-- Phase: Work Permit lifecycle (IPA -> arrival -> medical -> card -> cancellation -> repatriation)
-- plus MOM security bond tracking for non-Malaysian Work Permit holders.

alter table public.employees
  add column if not exists wp_stage text,
  add column if not exists ipa_issue_date date,
  add column if not exists ipa_expiry_date date,
  add column if not exists arrival_date date,
  add column if not exists medical_completed_date date,
  add column if not exists wp_card_collected_date date,
  add column if not exists cancellation_notified_on date,
  add column if not exists cancellation_date date,
  add column if not exists repatriation_date date,
  add column if not exists security_bond_required boolean,
  add column if not exists security_bond_amount numeric(12,2),
  add column if not exists security_bond_insurer text,
  add column if not exists security_bond_expiry date,
  add column if not exists security_bond_status text;

create index if not exists employees_wp_stage_idx on public.employees (wp_stage);
