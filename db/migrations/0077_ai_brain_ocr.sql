-- Separate OCR option; never enable existing readers or copy credentials into rows.
INSERT INTO public.api_integrations
  (id, category, label, url, model, env_key, api_key, priority, enabled)
SELECT
  'a9862d2f-4ef8-4f8b-8e30-f9b87b22b1dd'::uuid,
  'ocr', 'AI Brain', 'https://stbd.seobdshop.com/v1/chat/completions',
  'hr-brain', 'HR_BRAIN_API_KEY', NULL,
  COALESCE((SELECT MAX(priority) FROM public.api_integrations WHERE category = 'ocr'), 0) + 1,
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM public.api_integrations
  WHERE category = 'ocr' AND url = 'https://stbd.seobdshop.com/v1/chat/completions'
)
ON CONFLICT (id) DO NOTHING;