-- Remove leftover anon privileges on client_contracts (data-integrity risk).
REVOKE ALL ON public.client_contracts FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contracts TO authenticated;
GRANT ALL ON public.client_contracts TO service_role;
