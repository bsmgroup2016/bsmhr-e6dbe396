-- Prevent signup/profile triggers from auto-granting privileges.
CREATE OR REPLACE FUNCTION public.guard_role_assignment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF current_setting('role',true)='service_role' OR public.has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  RAISE EXCEPTION 'Only administrators can assign roles';
END;
$$;
DROP TRIGGER IF EXISTS guard_role_assignment ON public.user_roles;
CREATE TRIGGER guard_role_assignment BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_role_assignment();

CREATE OR REPLACE FUNCTION public.set_user_role(target_user uuid,next_role text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF target_user=auth.uid() THEN RAISE EXCEPTION 'Cannot change your own role'; END IF;
  IF next_role IS NOT NULL AND next_role NOT IN ('admin','manager','hr','supervisor','driver','accounts','it','client_user','employee') THEN RAISE EXCEPTION 'Invalid role'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(target_user::text));
  DELETE FROM public.user_roles WHERE user_id=target_user;
  IF next_role IS NOT NULL THEN INSERT INTO public.user_roles(user_id,role) VALUES(target_user,next_role::public.app_role); END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.set_user_role(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_assigned_role()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid());
$$;
REVOKE ALL ON FUNCTION public.has_assigned_role() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.has_assigned_role() TO authenticated;

-- Ordinary accounts cannot read or modify company tables, even via direct API calls.
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT tablename FROM pg_tables WHERE schemaname='public'
    AND tablename NOT IN ('profiles','user_roles','api_rate_limits') LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',item.tablename);
    EXECUTE format('DROP POLICY IF EXISTS assigned_role_required ON public.%I',item.tablename);
    EXECUTE format('CREATE POLICY assigned_role_required ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.has_assigned_role()) WITH CHECK (public.has_assigned_role())',item.tablename);
  END LOOP;
END $$;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roles_admin_write ON public.user_roles;
CREATE POLICY roles_admin_write ON public.user_roles AS RESTRICTIVE FOR ALL TO authenticated
USING(user_id=auth.uid() OR public.has_role(auth.uid(),'admin'))
WITH CHECK(public.has_role(auth.uid(),'admin'));

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['invoices','invoice_lines','rate_agreements','client_contracts','quotations','quotation_lines','expenses','payment_receipts','payroll_entries','clients'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS accounts_access ON public.%I',t);
      EXECUTE format('CREATE POLICY accounts_access ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(),''accounts'')) WITH CHECK (public.has_role(auth.uid(),''accounts''))',t);
    END IF;
  END LOOP;
END $$;
DROP POLICY IF EXISTS it_audit_read ON public.audit_logs;
CREATE POLICY it_audit_read ON public.audit_logs FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'it'));