-- db.ts orders employee_documents by created_at; table only had uploaded_at.
alter table public.employee_documents
  add column if not exists created_at timestamptz not null default now();

update public.employee_documents
  set created_at = coalesce(uploaded_at, now())
  where created_at is null or created_at > coalesce(uploaded_at, created_at);
