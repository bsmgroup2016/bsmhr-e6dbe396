-- Phase 3: document compliance metadata & versioning
alter table public.employee_documents
  add column if not exists doc_number text,
  add column if not exists issuing_authority text,
  add column if not exists reminder_days integer default 60,
  add column if not exists verified boolean default false,
  add column if not exists verified_by uuid,
  add column if not exists verified_at timestamptz,
  add column if not exists remarks text,
  add column if not exists version integer default 1,
  add column if not exists replaces_id uuid references public.employee_documents(id) on delete set null;

create index if not exists employee_documents_expiry_idx on public.employee_documents (expiry_date);
create index if not exists employee_documents_status_idx on public.employee_documents (status);
create index if not exists employee_documents_replaces_idx on public.employee_documents (replaces_id);
