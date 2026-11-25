-- Operational rent records stay relational; no files or snapshots are stored here.
BEGIN;
CREATE TABLE IF NOT EXISTS public.dorm_rent_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 dormitory_id uuid NOT NULL REFERENCES public.dormitories(id) ON DELETE RESTRICT,
 company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
 invoice_no text NOT NULL CHECK(length(btrim(invoice_no)) BETWEEN 1 AND 80),
 month text NOT NULL CHECK(month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
 invoice_date date NOT NULL, due_date date NOT NULL CHECK(due_date >= invoice_date),
 total_amount numeric(12,2) NOT NULL CHECK(total_amount > 0),
 remarks text NOT NULL DEFAULT '' CHECK(length(remarks)<=2000), voided boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(company_id,invoice_no)
);
GRANT SELECT ON public.dorm_rent_invoices TO authenticated;
GRANT ALL ON public.dorm_rent_invoices TO service_role;
ALTER TABLE public.dorm_rent_invoices ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS public.dorm_rent_payments (
 id uuid PRIMARY KEY, invoice_id uuid NOT NULL REFERENCES public.dorm_rent_invoices(id) ON DELETE RESTRICT,
 paid_on date NOT NULL, amount numeric(12,2) NOT NULL CHECK(amount>0),
 method text NOT NULL CHECK(method IN ('Bank transfer','PayNow','Cash','Cheque','Other')),
 reference text NOT NULL DEFAULT '' CHECK(length(reference)<=120), remarks text NOT NULL DEFAULT '' CHECK(length(remarks)<=1000),
 created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dorm_rent_payments TO authenticated;
GRANT ALL ON public.dorm_rent_payments TO service_role;
ALTER TABLE public.dorm_rent_payments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_dorm_billing(c uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT auth.uid() IS NOT NULL AND (
 public.has_role(auth.uid(),'admin') OR (
 (public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'hr') OR public.has_role(auth.uid(),'accounts'))
 AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND company_id=c AND is_active IS DISTINCT FROM false)
 ));
$$;
REVOKE ALL ON FUNCTION public.can_access_dorm_billing(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_access_dorm_billing(uuid) TO authenticated;
DROP POLICY IF EXISTS dorm_billing_read ON public.dorm_rent_invoices;
CREATE POLICY dorm_billing_read ON public.dorm_rent_invoices FOR SELECT TO authenticated USING(public.can_access_dorm_billing(company_id));
DROP POLICY IF EXISTS dorm_payments_read ON public.dorm_rent_payments;
CREATE POLICY dorm_payments_read ON public.dorm_rent_payments FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.dorm_rent_invoices i WHERE i.id=invoice_id AND public.can_access_dorm_billing(i.company_id)));

-- All mutations are atomic, authorized and locked per invoice; direct browser writes are not granted.
CREATE OR REPLACE FUNCTION public.manage_dorm_rent(action text, payload jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inv public.dorm_rent_invoices; result_id uuid; company uuid; dorm uuid; paid numeric; amount numeric; prior public.dorm_rent_payments;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
 IF action='create' THEN
  company:=(payload->>'companyId')::uuid; dorm:=(payload->>'dormitoryId')::uuid;
  IF NOT public.can_access_dorm_billing(company) THEN RAISE EXCEPTION 'Company access denied'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.dormitories WHERE id=dorm AND (company_id=company OR company_id IS NULL)) THEN RAISE EXCEPTION 'Dormitory does not belong to this company'; END IF;
  INSERT INTO public.dorm_rent_invoices(dormitory_id,company_id,invoice_no,month,invoice_date,due_date,total_amount,remarks)
  VALUES(dorm,company,btrim(payload->>'invoiceNo'),payload->>'month',(payload->>'invoiceDate')::date,(payload->>'dueDate')::date,(payload->>'totalAmount')::numeric,coalesce(payload->>'remarks','')) RETURNING id INTO result_id;
  RETURN result_id;
 END IF;
 SELECT * INTO inv FROM public.dorm_rent_invoices WHERE id=(payload->>'id')::uuid FOR UPDATE;
 IF NOT FOUND OR NOT public.can_access_dorm_billing(inv.company_id) THEN RAISE EXCEPTION 'Invoice not found or access denied'; END IF;
 IF inv.voided THEN RAISE EXCEPTION 'Voided invoices cannot be changed'; END IF;
 SELECT coalesce(sum(p.amount),0) INTO paid FROM public.dorm_rent_payments p WHERE p.invoice_id=inv.id;
 IF action='payment' THEN
  result_id:=(payload->>'requestId')::uuid;
  SELECT * INTO prior FROM public.dorm_rent_payments WHERE id=result_id;
  IF FOUND THEN
   IF prior.invoice_id=inv.id AND prior.amount=(payload->>'amount')::numeric AND prior.paid_on=(payload->>'paidOn')::date AND prior.method=payload->>'method' AND prior.reference=coalesce(payload->>'reference','') AND prior.remarks=coalesce(payload->>'remarks','') THEN RETURN result_id; END IF;
   RAISE EXCEPTION 'Payment reference already used';
  END IF;
  amount:=(payload->>'amount')::numeric;
  IF amount<=0 OR amount<>round(amount,2) OR amount>inv.total_amount-paid THEN RAISE EXCEPTION 'Payment exceeds balance or has invalid amount'; END IF;
  IF (payload->>'paidOn')::date>(now() AT TIME ZONE 'Asia/Singapore')::date THEN RAISE EXCEPTION 'Payment date cannot be in the future'; END IF;
  INSERT INTO public.dorm_rent_payments(id,invoice_id,paid_on,amount,method,reference,remarks,created_by)
  VALUES(result_id,inv.id,(payload->>'paidOn')::date,amount,payload->>'method',coalesce(payload->>'reference',''),coalesce(payload->>'remarks',''),auth.uid());
 ELSIF action='update' THEN
  IF paid>0 THEN RAISE EXCEPTION 'Paid invoices cannot be edited'; END IF;
  IF (payload->>'companyId')::uuid<>inv.company_id OR (payload->>'dormitoryId')::uuid<>inv.dormitory_id THEN RAISE EXCEPTION 'Invoice company and dormitory cannot change'; END IF;
  UPDATE public.dorm_rent_invoices SET invoice_no=btrim(payload->>'invoiceNo'),month=payload->>'month',invoice_date=(payload->>'invoiceDate')::date,due_date=(payload->>'dueDate')::date,total_amount=(payload->>'totalAmount')::numeric,remarks=coalesce(payload->>'remarks',''),updated_at=now() WHERE id=inv.id;
  result_id:=inv.id;
 ELSIF action='void' THEN
  IF paid>0 THEN RAISE EXCEPTION 'Invoices with recorded payments cannot be voided'; END IF;
  UPDATE public.dorm_rent_invoices SET voided=true,updated_at=now() WHERE id=inv.id;
  result_id:=inv.id;
 ELSE RAISE EXCEPTION 'Invalid billing action'; END IF;
 RETURN result_id;
END;
$$;
REVOKE ALL ON FUNCTION public.manage_dorm_rent(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.manage_dorm_rent(text,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
