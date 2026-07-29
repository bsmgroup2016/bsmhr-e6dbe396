create or replace function public.my_employee_id()
returns uuid language sql stable security definer set search_path = public as $$
  select e.id from public.employees e
  where lower(e.email) = lower(coalesce(auth.jwt() ->> 'email',''))
  limit 1
$$;
revoke all on function public.my_employee_id() from public;
grant execute on function public.my_employee_id() to authenticated;

drop policy if exists read_auth_employees on public.employees;
create policy read_employees on public.employees for select to authenticated
using (public.is_staff(auth.uid()) or id = public.my_employee_id());

drop policy if exists read_auth_employee_documents on public.employee_documents;
create policy read_employee_documents on public.employee_documents for select to authenticated
using (public.is_staff(auth.uid()) or employee_id = public.my_employee_id());

drop policy if exists read_auth_payroll_entries on public.payroll_entries;
create policy read_payroll_entries on public.payroll_entries for select to authenticated
using (public.is_backoffice(auth.uid()) or employee_id = public.my_employee_id());

drop policy if exists read_auth_attendance on public.attendance;
create policy read_attendance on public.attendance for select to authenticated
using (public.is_staff(auth.uid()) or employee_id = public.my_employee_id());

drop policy if exists read_auth_assignments on public.assignments;
create policy read_assignments on public.assignments for select to authenticated
using (public.is_staff(auth.uid()) or employee_id = public.my_employee_id());

drop policy if exists "leave read" on public.leave_requests;
create policy read_leave_requests on public.leave_requests for select to authenticated
using (public.is_staff(auth.uid()) or employee_id = public.my_employee_id());

drop policy if exists read_auth_clients on public.clients;
create policy read_clients on public.clients for select to authenticated
using (public.is_staff(auth.uid()));

drop policy if exists read_auth_projects on public.projects;
create policy read_projects on public.projects for select to authenticated
using (public.is_staff(auth.uid()));

drop policy if exists read_auth_sites on public.sites;
create policy read_sites on public.sites for select to authenticated
using (public.is_staff(auth.uid()));

drop policy if exists read_auth_approvals on public.approvals;
create policy read_approvals on public.approvals for select to authenticated
using (public.is_staff(auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['approvals','asset_issuances','assets','assignments','attendance','audit_logs','bed_allocations','candidates','clients','companies','crm_activities','dormitories','employee_documents','employees','expenses','inventory_items','invoices','job_requisitions','leads','leave_requests','payment_receipts','payroll_entries','profiles','projects','purchase_orders','rate_agreements','safety_incidents','sites','stock_movements','storage_objects','training_courses','training_records','trips','user_roles','vehicles']
  loop
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;
