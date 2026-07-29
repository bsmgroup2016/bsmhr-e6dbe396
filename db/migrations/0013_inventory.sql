-- Phase 13: Inventory & Procurement (store items, stock movements, purchase orders)

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  sku text not null default '',
  name text not null,
  category text not null default 'Other',
  unit text not null default 'pcs',
  opening_qty numeric not null default 0,
  reorder_level numeric not null default 0,
  unit_cost numeric not null default 0,
  location text,
  supplier text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  po_no text not null,
  supplier text not null default '',
  item_id uuid references public.inventory_items(id) on delete set null,
  quantity numeric not null default 0,
  unit_cost numeric not null default 0,
  order_date date not null default current_date,
  expected_date date,
  received_date date,
  status text not null default 'Draft',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  movement_type text not null default 'In',
  quantity numeric not null default 0,
  movement_date date not null default current_date,
  site_id uuid references public.sites(id) on delete set null,
  employee_id uuid references public.employees(id) on delete set null,
  po_id uuid references public.purchase_orders(id) on delete set null,
  reference_no text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.inventory_items to authenticated;
grant all on public.inventory_items to service_role;
grant select, insert, update, delete on public.stock_movements to authenticated;
grant all on public.stock_movements to service_role;
grant select, insert, update, delete on public.purchase_orders to authenticated;
grant all on public.purchase_orders to service_role;

alter table public.inventory_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.purchase_orders enable row level security;

drop policy if exists "staff read inventory" on public.inventory_items;
create policy "staff read inventory" on public.inventory_items
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'supervisor'));

drop policy if exists "staff write inventory" on public.inventory_items;
create policy "staff write inventory" on public.inventory_items
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

drop policy if exists "staff read movements" on public.stock_movements;
create policy "staff read movements" on public.stock_movements
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'supervisor'));

drop policy if exists "staff write movements" on public.stock_movements;
create policy "staff write movements" on public.stock_movements
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'supervisor'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager') or public.has_role(auth.uid(), 'supervisor'));

drop policy if exists "staff read po" on public.purchase_orders;
create policy "staff read po" on public.purchase_orders
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

drop policy if exists "staff write po" on public.purchase_orders;
create policy "staff write po" on public.purchase_orders
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create index if not exists idx_inventory_category on public.inventory_items(category);
create index if not exists idx_movements_item on public.stock_movements(item_id);
create index if not exists idx_movements_date on public.stock_movements(movement_date);
create index if not exists idx_po_status on public.purchase_orders(status);
