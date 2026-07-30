-- Remove leftover anon grants (anon must never touch HR/finance data)
REVOKE ALL ON public.medical_claims FROM anon;
REVOKE ALL ON public.employee_loans FROM anon;
REVOKE ALL ON public.loan_repayments FROM anon;

-- TRUNCATE bypasses RLS entirely; no app role needs it
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM authenticated, anon', t.tablename);
  END LOOP;
END $$;
