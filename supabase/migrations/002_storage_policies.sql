-- ============================================================
-- Storage Policies for loan_documents bucket
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Users can UPLOAD files to their own folder (user_id prefix)
CREATE POLICY "Users can upload own documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'loan_documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 2. Users can VIEW/DOWNLOAD their own documents
CREATE POLICY "Users can read own documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'loan_documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Admins/Owners can VIEW/DOWNLOAD all documents
CREATE POLICY "Admins can read all loan documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'loan_documents' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- 4. Users can DELETE their own documents (optional, for re-uploads)
CREATE POLICY "Users can delete own documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'loan_documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
