-- ============================================================================
-- HARDEN MANUSCRIPT RLS (PR 1, migration 5/7)
-- ============================================================================
-- Replaces the broad FOR ALL author policy (which let authors edit
-- workflow-controlled fields such as status and editorial_notes) with
-- separated per-operation policies, authoritative profile-role admin checks,
-- a workflow-field protection trigger, and author-safe views.
-- Admin authority comes from profiles.role — NEVER auth.jwt() metadata.
-- ============================================================================

-- 1) Helper functions --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.current_profile_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_is_admin() TO authenticated, service_role;

-- 2) Drop unsafe policies ----------------------------------------------------
DROP POLICY IF EXISTS "Authors can view own manuscripts" ON manuscripts;
DROP POLICY IF EXISTS "Authors can manage own manuscripts" ON manuscripts;

-- 3) New manuscripts policies ------------------------------------------------
DROP POLICY IF EXISTS manuscripts_select_own_or_admin ON manuscripts;
CREATE POLICY manuscripts_select_own_or_admin ON manuscripts
  FOR SELECT TO authenticated
  USING (
    public.current_user_is_admin()
    OR author_id IN (
      SELECT a.id FROM authors a
      WHERE a.profile_id = public.current_profile_id()
    )
  );

DROP POLICY IF EXISTS manuscripts_insert_own_drafts ON manuscripts;
CREATE POLICY manuscripts_insert_own_drafts ON manuscripts
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id IN (
      SELECT a.id FROM authors a
      WHERE a.profile_id = public.current_profile_id()
    )
    AND status IN ('draft', 'submitted')
  );

DROP POLICY IF EXISTS manuscripts_update_own_editable ON manuscripts;
CREATE POLICY manuscripts_update_own_editable ON manuscripts
  FOR UPDATE TO authenticated
  USING (
    author_id IN (
      SELECT a.id FROM authors a
      WHERE a.profile_id = public.current_profile_id()
    )
    AND status IN ('draft', 'revisions_requested', 'submitted')
  )
  WITH CHECK (
    author_id IN (
      SELECT a.id FROM authors a
      WHERE a.profile_id = public.current_profile_id()
    )
  );

DROP POLICY IF EXISTS manuscripts_delete_own_drafts ON manuscripts;
CREATE POLICY manuscripts_delete_own_drafts ON manuscripts
  FOR DELETE TO authenticated
  USING (
    author_id IN (
      SELECT a.id FROM authors a
      WHERE a.profile_id = public.current_profile_id()
    )
    AND status = 'draft'
  );

DROP POLICY IF EXISTS manuscripts_admin_all ON manuscripts;
CREATE POLICY manuscripts_admin_all ON manuscripts
  FOR ALL TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

-- 4) Workflow-field protection trigger ---------------------------------------
-- RLS alone cannot enforce field-level immutability; this trigger prevents
-- non-admin callers from changing workflow-controlled columns and restricts
-- author status transitions to the legal set:
--   draft -> submitted
--   revisions_requested -> submitted
--   submitted -> withdrawn
CREATE OR REPLACE FUNCTION protect_manuscript_workflow_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role (no auth context) and authoritative admins bypass.
  IF auth.uid() IS NULL OR public.current_user_is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_reviewer_id    IS DISTINCT FROM OLD.assigned_reviewer_id
    OR NEW.assigned_at           IS DISTINCT FROM OLD.assigned_at
    OR NEW.review_started_at     IS DISTINCT FROM OLD.review_started_at
    OR NEW.decision_at           IS DISTINCT FROM OLD.decision_at
    OR NEW.editorial_notes       IS DISTINCT FROM OLD.editorial_notes
    OR NEW.internal_notes        IS DISTINCT FROM OLD.internal_notes
    OR NEW.book_id               IS DISTINCT FROM OLD.book_id
    OR NEW.converted_at          IS DISTINCT FROM OLD.converted_at
    OR NEW.converted_by_profile_id IS DISTINCT FROM OLD.converted_by_profile_id
  THEN
    RAISE EXCEPTION 'Workflow-controlled manuscript fields can only be changed by staff';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'draft' AND NEW.status = 'submitted')
      OR (OLD.status = 'revisions_requested' AND NEW.status = 'submitted')
      OR (OLD.status = 'submitted' AND NEW.status = 'withdrawn')
    ) THEN
      RAISE EXCEPTION 'Illegal manuscript status transition % -> % for author', OLD.status, NEW.status;
    END IF;
    IF NEW.status = 'submitted' THEN
      NEW.submitted_at := COALESCE(NEW.submitted_at, NOW());
    ELSIF NEW.status = 'withdrawn' THEN
      NEW.withdrawn_at := COALESCE(NEW.withdrawn_at, NOW());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_manuscript_workflow ON manuscripts;
CREATE TRIGGER protect_manuscript_workflow
  BEFORE UPDATE ON manuscripts
  FOR EACH ROW
  EXECUTE FUNCTION protect_manuscript_workflow_fields();

-- 5) manuscript_status_history policies --------------------------------------
-- Authors never read the raw table (internal_reason/metadata live there).
DROP POLICY IF EXISTS manuscript_history_admin_select ON manuscript_status_history;
CREATE POLICY manuscript_history_admin_select ON manuscript_status_history
  FOR SELECT TO authenticated
  USING (public.current_user_is_admin());
-- No client INSERT/UPDATE/DELETE policies: history is trigger-controlled.

-- Author-safe history view (excludes internal_reason, metadata, actor).
CREATE OR REPLACE VIEW author_manuscript_status_history
WITH (security_invoker = false) AS
SELECT
  h.id,
  h.manuscript_id,
  h.from_status,
  h.to_status,
  h.reason,
  h.created_at
FROM manuscript_status_history h
WHERE h.manuscript_id IN (
  SELECT m.id
  FROM manuscripts m
  JOIN authors a ON a.id = m.author_id
  WHERE a.profile_id = public.current_profile_id()
);

REVOKE ALL ON author_manuscript_status_history FROM PUBLIC, anon;
GRANT SELECT ON author_manuscript_status_history TO authenticated, service_role;

-- 6) manuscript_reviews policies ---------------------------------------------
DROP POLICY IF EXISTS manuscript_reviews_admin_all ON manuscript_reviews;
CREATE POLICY manuscript_reviews_admin_all ON manuscript_reviews
  FOR ALL TO authenticated
  USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

DROP POLICY IF EXISTS manuscript_reviews_reviewer_select ON manuscript_reviews;
CREATE POLICY manuscript_reviews_reviewer_select ON manuscript_reviews
  FOR SELECT TO authenticated
  USING (reviewer_profile_id = public.current_profile_id());

DROP POLICY IF EXISTS manuscript_reviews_reviewer_update ON manuscript_reviews;
CREATE POLICY manuscript_reviews_reviewer_update ON manuscript_reviews
  FOR UPDATE TO authenticated
  USING (
    reviewer_profile_id = public.current_profile_id()
    AND manuscript_id IN (
      SELECT m.id FROM manuscripts m
      WHERE m.assigned_reviewer_id = public.current_profile_id()
    )
  )
  WITH CHECK (
    reviewer_profile_id = public.current_profile_id()
  );
-- No author raw access: authors use the safe view below.

-- Author-safe review feedback view (no reviewer identity, no internal notes,
-- only submitted decisions).
CREATE OR REPLACE VIEW author_manuscript_feedback
WITH (security_invoker = false) AS
SELECT
  r.manuscript_id,
  r.decision,
  r.author_feedback,
  r.review_round,
  r.submitted_at
FROM manuscript_reviews r
WHERE r.submitted_at IS NOT NULL
  AND r.manuscript_id IN (
    SELECT m.id
    FROM manuscripts m
    JOIN authors a ON a.id = m.author_id
    WHERE a.profile_id = public.current_profile_id()
  );

REVOKE ALL ON author_manuscript_feedback FROM PUBLIC, anon;
GRANT SELECT ON author_manuscript_feedback TO authenticated, service_role;
