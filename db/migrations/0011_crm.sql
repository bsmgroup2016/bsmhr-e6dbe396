-- Phase 11: Client CRM (leads + activities)

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  company_name text not null,
  contact_person text,
  phone text,
  email text,
  industry text,
  trade text,
  headcount_needed integer,
  monthly_value numeric not null default 0,
  source text not null default 'Other',
  stage text not null default 'New',
  probability integer not null default 0,
  expected_close_date date,
  owner_name text,
  lost_reason text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  company_id uuid references public.companies(id) on delete set null,
  activity_date date not null default current_date,
  activity_type text not null default 'Note',
  subject text not null,
  notes text,
  follow_up_date date,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.leads to authenticated;
grant all on public.leads to service_role;
grant select, insert, update, delete on public.crm_activities to authenticated;
grant all on public.crm_activities to service_role;

alter table public.leads enable row level security;
alter table public.crm_activities enable row level security;

drop policy if exists "staff read leads" on public.leads;
create policy "staff read leads" on public.leads
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

drop policy if exists "staff write leads" on public.leads;
create policy "staff write leads" on public.leads
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

drop policy if exists "staff read crm activities" on public.crm_activities;
create policy "staff read crm activities" on public.crm_activities
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

drop policy if exists "staff write crm activities" on public.crm_activities;
create policy "staff write crm activities" on public.crm_activities
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'manager'));

create index if not exists idx_leads_stage on public.leads(stage);
create index if not exists idx_crm_activities_lead on public.crm_activities(lead_id);
create index if not exists idx_crm_activities_followup on public.crm_activities(follow_up_date);
