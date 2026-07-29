-- Harden audit_logs inserts: users may only write rows attributed to themselves
drop policy if exists audit_insert_auth on public.audit_logs;
create policy audit_insert_self on public.audit_logs
  for insert to authenticated
  with check (user_id = auth.uid());

-- Remove leftover anon table privileges on newer tables
revoke all on public.time_cards from anon;
revoke all on public.claim_sheets from anon;
revoke all on public.employee_certifications from anon;
revoke all on public.branch_prefixes from anon;
