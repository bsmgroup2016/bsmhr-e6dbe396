-- Apply and commit this file before 0068.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'driver';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accounts';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'it';