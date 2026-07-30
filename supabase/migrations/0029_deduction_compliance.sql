alter table public.payroll_entries
  add column if not exists accommodation_deduction numeric not null default 0,
  add column if not exists loan_repayment numeric not null default 0,
  add column if not exists other_deductions numeric not null default 0,
  add column if not exists deduction_consent boolean not null default false;
