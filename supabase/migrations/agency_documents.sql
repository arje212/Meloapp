ALTER TABLE public.agencies
  ADD COLUMN IF NOT EXISTS business_reg_document_path text,
  ADD COLUMN IF NOT EXISTS permit_document_path text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agency-documents',
  'agency-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS agency_documents_read ON storage.objects;
CREATE POLICY agency_documents_read ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'agency-documents'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  )
);

DROP POLICY IF EXISTS agency_documents_upload ON storage.objects;
CREATE POLICY agency_documents_upload ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'agency-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS agency_documents_update ON storage.objects;
CREATE POLICY agency_documents_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'agency-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'agency-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS agency_documents_delete ON storage.objects;
CREATE POLICY agency_documents_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'agency-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
