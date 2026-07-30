-- FWMI / Employment Act salary compliance tracking
alter table public.employees
  add column if not exists declared_salary numeric,
  add column if not exists fixed_allowance numeric,
  add column if not exists ket_issued_on date,
  add column if not exists salary_payment_mode text;

alter table public.payroll_entries
  add column if not exists overtime_hours numeric default 0,
  add column if not exists payslip_issued_at timestamptz;
