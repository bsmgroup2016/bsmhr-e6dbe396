-- Safety course (SCOS / CSOC / SOC) tracking on employee master
alter table public.employees
  add column if not exists safety_course_type text,
  add column if not exists safety_course_no text,
  add column if not exists safety_course_expiry date;

create index if not exists employees_safety_course_expiry_idx on public.employees (safety_course_expiry);
