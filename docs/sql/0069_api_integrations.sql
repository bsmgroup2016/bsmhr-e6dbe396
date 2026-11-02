create table if not exists public.api_integrations (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('ocr','chatbot')),
  label text not null, url text not null, model text not null,
  api_key text, env_key text,
  priority int not null default 1, enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.api_integrations enable row level security;
revoke all on public.api_integrations from anon, authenticated;
grant all on public.api_integrations to service_role;
insert into public.api_integrations (category, label, url, model, env_key, priority)
select * from (values
  ('ocr','Google Gemini (paid)','https://generativelanguage.googleapis.com/v1beta/openai/chat/completions','gemini-3.8-flash','GEMINI_API_KEY',1),
  ('ocr','OpenAI (paid)','https://api.openai.com/v1/chat/completions','gpt-4o','OPENAI_API_KEY',2),
  ('chatbot','Gemini #1','https://generativelanguage.googleapis.com/v1beta/openai/chat/completions','gemini-3.5-flash','ASSISTANT_GEMINI_KEY_1',1),
  ('chatbot','Gemini #2','https://generativelanguage.googleapis.com/v1beta/openai/chat/completions','gemini-3.5-flash','ASSISTANT_GEMINI_KEY_2',2),
  ('chatbot','Groq','https://api.groq.com/openai/v1/chat/completions','openai/gpt-oss-120b','ASSISTANT_GROQ_KEY',3),
  ('chatbot','OpenRouter','https://openrouter.ai/api/v1/chat/completions','openai/gpt-4o-mini','ASSISTANT_OPENROUTER_KEY',4)
) v(category,label,url,model,env_key,priority)
where not exists (select 1 from public.api_integrations);
