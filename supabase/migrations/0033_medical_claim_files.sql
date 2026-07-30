-- Multiple hospital bill attachments per medical claim
ALTER TABLE public.medical_claims
  ADD COLUMN IF NOT EXISTS document_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.medical_claims
   SET document_urls = jsonb_build_array(document_url)
 WHERE document_url IS NOT NULL
   AND document_url <> ''
   AND document_urls = '[]'::jsonb;
