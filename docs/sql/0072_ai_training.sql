-- Chatbot training: knowledge base, skills, crawl history and schedule.
-- Service-role-only: all access goes through /api/public/ai-training (admin) and the cron tick.
CREATE TABLE IF NOT EXISTS public.ai_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('snapshot','note','skill')),
  source text NOT NULL DEFAULT 'manual',
  title text NOT NULL,
  content text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_knowledge_snapshot_uniq ON public.ai_knowledge(title) WHERE kind = 'snapshot';

CREATE TABLE IF NOT EXISTS public.ai_crawl_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'running',
  tables_scanned int NOT NULL DEFAULT 0,
  rows_seen bigint NOT NULL DEFAULT 0,
  skills_generated int NOT NULL DEFAULT 0,
  provider text,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.ai_training_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  crawls_per_day int NOT NULL DEFAULT 4 CHECK (crawls_per_day BETWEEN 0 AND 24),
  auto_skills boolean NOT NULL DEFAULT true,
  skills_generated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.ai_training_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT ALL ON public.ai_knowledge, public.ai_crawl_runs, public.ai_training_settings TO service_role;
REVOKE ALL ON public.ai_knowledge, public.ai_crawl_runs, public.ai_training_settings FROM anon, authenticated;
ALTER TABLE public.ai_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_crawl_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_training_settings ENABLE ROW LEVEL SECURITY;

-- Hourly tick; the endpoint decides whether a crawl is due from crawls_per_day.
-- (Applied with the real CRON_SECRET in place of <CRON_SECRET>.)
-- SELECT cron.schedule('bsm-ai-training', '7 * * * *', $$
--   SELECT net.http_post(url := 'https://www.hrbsm.xyz/api/public/ai-training',
--     headers := '{"Content-Type":"application/json","x-cron-secret":"<CRON_SECRET>"}'::jsonb,
--     body := '{"action":"cron"}'::jsonb);
-- $$);
