-- ============================================================================
-- HARDEN MANUSCRIPT STORAGE (PR 1, migration 6/7)
-- ============================================================================
-- Keeps the existing private bucket, 100 MiB limit, and four MIME types.
-- Adds per-user path isolation, owner-scoped policies, draft-only deletion,
-- and replaces the JWT-metadata admin dependency with profiles.role.
-- Path convention for all future uploads:
--   <auth-user-id>/<manuscript-id>/<version-number>/<sanitized-file-name>
-- ============================================================================

-- 1) Bucket configuration (unchanged values, asserted) -----------------------
UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
WHERE id = 'manuscripts';

-- 2) Drop conflicting policies ----------------------------------------------
-- The legacy admin policy relied on auth.jwt() ->> 'role', which clients can
-- influence. Admin authority must come from profiles.role.
DROP POLICY IF EXISTS "Admins have full access to all files" ON storage.objects;
DROP POLICY IF EXISTS manuscripts_storage_insert_own ON storage.objects;
DROP POLICY IF EXISTS manuscripts_storage_select_own ON storage.objects;
DROP POLICY IF EXISTS manuscripts_storage_delete_own_draft ON storage.objects;
DROP POLICY IF EXISTS manuscripts_storage_admin_all ON storage.objects;

-- 3) Manuscript bucket policies ----------------------------------------------
CREATE POLICY manuscripts_storage_insert_own
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'manuscripts'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (metadata->>'size')::bigint <= 104857600
    AND metadata->>'mimetype' IN (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    )
  );

CREATE POLICY manuscripts_storage_select_own
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'manuscripts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Deletion allowed only while the matching manuscript is still a draft.
-- Submitted files are preserved as editorial records.
CREATE POLICY manuscripts_storage_delete_own_draft
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'manuscripts'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM manuscripts m
      JOIN authors a ON a.id = m.author_id
      JOIN profiles p ON p.id = a.profile_id
      WHERE p.user_id = auth.uid()
        AND m.id::text = (storage.foldername(name))[2]
        AND m.status = 'draft'
    )
  );

-- No author UPDATE policy on purpose: new versions are new uploads.

-- Authoritative admin access (profiles.role, not JWT metadata).
CREATE POLICY manuscripts_storage_admin_all
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'manuscripts'
    AND public.current_user_is_admin()
  )
  WITH CHECK (
    bucket_id = 'manuscripts'
    AND public.current_user_is_admin()
  );

-- 4) Replace the placeholder "virus scan" trigger ----------------------------
-- check_file_safety() only wrote a log line and scanned nothing. Do not imply
-- scanning exists: mark uploads as pending scan for a future integration.
DROP TRIGGER IF EXISTS check_manuscript_safety ON storage.objects;
DROP FUNCTION IF EXISTS check_file_safety();

CREATE OR REPLACE FUNCTION mark_manuscript_scan_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No malware scanning is implemented yet. Tag the object so a future
  -- scanning pipeline can find unscanned uploads.
  NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb)
    || jsonb_build_object('scan_status', 'pending');
  RETURN NEW;
END;
$$;

CREATE TRIGGER manuscript_upload_scan_pending
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'manuscripts')
  EXECUTE FUNCTION mark_manuscript_scan_pending();

COMMENT ON FUNCTION mark_manuscript_scan_pending() IS
  'Tags manuscript uploads scan_status=pending. Actual malware scanning is a later application/infrastructure PR.';
