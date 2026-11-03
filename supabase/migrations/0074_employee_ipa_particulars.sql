-- Dedicated editable IPA particulars. No data backfill, payroll or RLS changes.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS highest_qualification text,
  ADD COLUMN IF NOT EXISTS father_name text,
  ADD COLUMN IF NOT EXISTS mother_name text,
  ADD COLUMN IF NOT EXISTS criminal_record text,
  ADD COLUMN IF NOT EXISTS industry text,
  ADD COLUMN IF NOT EXISTS occupation_code text,
  ADD COLUMN IF NOT EXISTS housing_provided text,
  ADD COLUMN IF NOT EXISTS ipa_basic_monthly_salary numeric,
  ADD COLUMN IF NOT EXISTS ipa_housing_deduction numeric,
  ADD COLUMN IF NOT EXISTS ipa_other_deduction numeric,
  ADD COLUMN IF NOT EXISTS ipa_net_monthly_salary numeric,
  ADD COLUMN IF NOT EXISTS ipa_normal_hours_per_week numeric,
  ADD COLUMN IF NOT EXISTS ipa_working_days_per_week numeric,
  ADD COLUMN IF NOT EXISTS ipa_daily_rest_day_rate numeric,
  ADD COLUMN IF NOT EXISTS agency_name text,
  ADD COLUMN IF NOT EXISTS agency_licence text,
  ADD COLUMN IF NOT EXISTS agency_address text,
  ADD COLUMN IF NOT EXISTS agency_phone text,
  ADD COLUMN IF NOT EXISTS agency_fee numeric,
  ADD COLUMN IF NOT EXISTS agency_overseas_costs numeric,
  ADD COLUMN IF NOT EXISTS agency_employee_paid_fees text;
NOTIFY pgrst, 'reload schema';
