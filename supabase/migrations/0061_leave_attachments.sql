-- Medical certificate / supporting document attachments on leave requests
alter table public.leave_requests
  add column if not exists attachment_urls text[] not null default '{}'::text[];

comment on column public.leave_requests.attachment_urls is
  'R2 object references (keys or /api/public/r2-file links) for MC / supporting docs';
