-- Performance hardening for 5000+ workers / 100+ staff / 200+ projects / 50+ drivers.
-- Every index is created only when the table AND all of its columns exist, so this
-- migration is safe to run against any state of the schema.

do $$
declare
  spec record;
  cols text[];
  missing boolean;
  c text;
  sql text;
begin
  for spec in
    select * from (values
      -- hot path: daily attendance lookups
      ('attendance',            'attendance_emp_date_idx',        array['employee_id','date']),
      ('attendance',            'attendance_date_idx',            array['date']),
      ('attendance',            'attendance_site_date_idx',       array['site_id','date']),
      ('attendance',            'attendance_project_date_idx',    array['project_id','date']),
      ('attendance',            'attendance_status_idx',          array['status']),
      -- offline punch queue
      ('attendance_events',     'attendance_events_recorded_idx', array['recorded_at']),
      ('attendance_events',     'attendance_events_site_date_idx',array['site_id','date']),
      ('attendance_events',     'attendance_events_user_idx',     array['user_id']),
      -- drivers
      ('driver_tasks',          'driver_tasks_driver_status_idx', array['driver_id','status']),
      ('driver_tasks',          'driver_tasks_status_idx',        array['status']),
      ('driver_task_pings',     'driver_task_pings_task_idx',     array['task_id']),
      ('driver_task_pings',     'driver_task_pings_recorded_idx', array['recorded_at']),
      ('driver_profiles',       'driver_profiles_employee_idx',   array['employee_id']),
      ('driver_fuel_logs',      'driver_fuel_logs_vehicle_idx',   array['vehicle_id']),
      ('driver_incidents',      'driver_incidents_driver_idx',    array['driver_id']),
      ('trips',                 'trips_vehicle_idx',              array['vehicle_id']),
      ('trips',                 'trips_date_idx',                 array['date']),
      -- notifications / devices
      ('notifications',         'notifications_user_unread_idx',  array['user_id','read_at']),
      ('device_tokens',         'device_tokens_employee_idx',     array['employee_id']),
      -- workforce
      ('employees',             'employees_company_status_idx',   array['company_id','status']),
      ('employees',             'employees_status_idx',           array['status']),
      ('employees',             'employees_designation_idx',      array['designation']),
      ('employees',             'employees_designation_id_idx',   array['designation_id']),
      ('employees',             'employees_pfile_idx',            array['p_file_number']),
      ('employees',             'employees_fin_idx',              array['fin_number']),
      ('employee_documents',    'employee_documents_emp_idx',     array['employee_id']),
      ('employee_certifications','employee_certifications_emp_idx',array['employee_id']),
      ('employee_loans',        'employee_loans_emp_idx',         array['employee_id']),
      ('loan_repayments',       'loan_repayments_loan_idx',       array['loan_id']),
      ('assignments',           'assignments_employee_idx',       array['employee_id']),
      ('assignments',           'assignments_project_idx',        array['project_id']),
      -- leave / payroll / claims
      ('leave_requests',        'leave_requests_emp_status_idx',  array['employee_id','status']),
      ('leave_requests',        'leave_requests_status_idx',      array['status']),
      ('medical_claims',        'medical_claims_emp_idx',         array['employee_id']),
      ('payroll_entries',       'payroll_entries_emp_idx',        array['employee_id']),
      ('time_cards',            'time_cards_emp_idx',             array['employee_id']),
      ('claim_sheets',          'claim_sheets_project_idx',       array['project_id']),
      -- commercial
      ('invoices',              'invoices_client_status_idx',     array['client_id','status']),
      ('invoices',              'invoices_company_idx',           array['company_id']),
      ('payment_receipts',      'payment_receipts_invoice_idx',   array['invoice_id']),
      ('quotations',            'quotations_status_idx',          array['status']),
      ('client_contracts',      'client_contracts_client_idx',    array['client_id']),
      ('rate_agreements',       'rate_agreements_contract_idx',   array['contract_id']),
      ('projects',              'projects_client_idx',            array['client_id']),
      ('sites',                 'sites_project_idx',              array['project_id']),
      ('manpower_requests',     'manpower_requests_status_idx',   array['status']),
      ('manpower_request_items','manpower_request_items_req_idx', array['request_id']),
      ('expenses',              'expenses_project_idx',           array['project_id']),
      -- accommodation
      ('bed_allocations',       'bed_allocations_emp_idx',        array['employee_id']),
      ('bed_allocations',       'bed_allocations_dorm_idx',       array['dormitory_id']),
      ('dormitory_invoices',    'dormitory_invoices_dorm_idx',    array['dormitory_id']),
      ('dormitory_inspections', 'dormitory_inspections_dorm_idx', array['dormitory_id']),
      ('dormitory_movements',   'dormitory_movements_emp_idx',    array['employee_id']),
      -- inventory & assets
      ('asset_issuances',       'asset_issuances_emp_idx',        array['employee_id']),
      ('asset_issuances',       'asset_issuances_asset_idx',      array['asset_id']),
      ('stock_movements',       'stock_movements_item_idx',       array['item_id']),
      ('inventory_items',       'inventory_items_category_idx',   array['category']),
      -- misc
      ('audit_logs',            'audit_logs_created_idx',         array['created_at']),
      ('approvals',             'approvals_status_idx',           array['status']),
      ('user_roles',            'user_roles_user_idx',            array['user_id']),
      ('safety_incidents',      'safety_incidents_project_idx',   array['project_id']),
      ('training_records',      'training_records_emp_idx',       array['employee_id'])
    ) as t(tbl, idx, cols)
  loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = spec.tbl
    ) then
      continue;
    end if;

    cols := spec.cols;
    missing := false;
    foreach c in array cols loop
      if not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = spec.tbl and column_name = c
      ) then
        missing := true;
      end if;
    end loop;
    if missing then
      continue;
    end if;

    sql := format(
      'create index if not exists %I on public.%I (%s)',
      spec.idx, spec.tbl,
      (select string_agg(quote_ident(x), ', ') from unnest(cols) as x)
    );
    execute sql;
  end loop;
end $$;

-- Keep the planner statistics fresh for the hottest tables.
do $$
declare t text;
begin
  foreach t in array array['attendance','attendance_events','employees','driver_task_pings','notifications'] loop
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name=t) then
      execute format('analyze public.%I', t);
    end if;
  end loop;
end $$;
