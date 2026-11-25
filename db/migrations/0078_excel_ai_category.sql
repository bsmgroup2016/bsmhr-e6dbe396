-- Allow a separate Excel AI provider list (e.g. Claude) for formula-driven analysis workbooks.
ALTER TABLE public.api_integrations DROP CONSTRAINT IF EXISTS api_integrations_category_check;
ALTER TABLE public.api_integrations ADD CONSTRAINT api_integrations_category_check
  CHECK (category = ANY (ARRAY['ocr'::text, 'chatbot'::text, 'excel_ai'::text]));
