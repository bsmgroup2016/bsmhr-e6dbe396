-- Migration: 0075_payroll_bonus.sql
-- Add bonus column to payroll_entries to persist Additional Wages across recalculations and payslip generation.

alter table public.payroll_entries
  add column if not exists bonus numeric not null default 0;
