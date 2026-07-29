create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  asset_code text not null default '',
  name text not null,
  category text not null default 'PPE',
  serial_no text,
  brand text,
  quantity integer not null default 1,
  unit_cost numeric not null default 0,
  purchase_date date,
  warranty_expiry date,
  calibration_due date,
  location text,
  status text not null default 'Available',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.asset_issuances (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null,
  quantity integer not null default 1,
  issue_date date not null default current_date,
  due_date date,
  return_date date,
  condition_out text not null default 'Good',
  condition_in text,
  status text not null default 'Issued',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assets_company_idx on public.assets(company_id);
create index if not exists asset_issuances_asset_idx on public.asset_issuances(asset_id);
create index if not exists asset_issuances_emp_idx on public.asset_issuances(employee_id);

grant select, insert, update, delete on public.assets to authenticated;
grant all on public.assets to service_role;
grant select, insert, update, delete on public.asset_issuances to authenticated;
grant all on public.asset_issuances to service_role;

alter table public.assets enable row level security;
alter table public.asset_issuances enable row level security;

do $$
declare t text;
begin
  foreach t in array array['assets','asset_issuances'] loop
    execute format('drop policy if exists "%s read" on public.%I', t, t);
    execute format('create policy "%s read" on public.%I for select to authenticated using (true)', t, t);
    execute format('drop policy if exists "%s write" on public.%I', t, t);
    execute format($f$create policy "%s write" on public.%I for all to authenticated
      using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
      with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))$f$, t, t);
  end loop;
end $$;
