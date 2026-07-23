-- ============================================================================
-- CREATE MANUSCRIPT STATUS HISTORY (PR 1, migration 2/7)
-- ============================================================================
-- Immutable, trigger-maintained audit of every manuscript status transition.
-- Corrections are new rows; history rows are never updated or deleted.
-- ============================================================================

CREATE TABLE IF NOT EXISTS manuscript_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL REFERENCES manuscripts(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT,
  internal_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT manuscript_history_to_status_check CHECK (
    to_status IN (
      'draft', 'submitted', 'under_review', 'revisions_requested',
      'accepted', 'rejected', 'withdrawn', 'converted_to_book'
    )
  ),
  CONSTRAINT manuscript_history_transition_check CHECK (
    from_status IS NULL OR from_status <> to_status
  ),
  CONSTRAINT manuscript_history_reason_length CHECK (
    reason IS NULL OR length(reason) <= 5000
  ),
  CONSTRAINT manuscript_history_internal_reason_length CHECK (
    internal_reason IS NULL OR length(internal_reason) <= 10000
  )
);

-- Immutability -----------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_manuscript_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Manuscript status history records are immutable';
END;
$$;

DROP TRIGGER IF EXISTS manuscript_history_immutable ON manuscript_status_history;
CREATE TRIGGER manuscript_history_immutable
  BEFORE UPDATE OR DELETE ON manuscript_status_history
  FOR EACH ROW
  EXECUTE FUNCTION prevent_manuscript_history_mutation();

-- Automatic history ------------------------------------------------------
-- Actor may be supplied through a transaction-local setting:
--   SELECT set_config('app.changed_by_profile_id', '<profile-uuid>', true);
CREATE OR REPLACE FUNCTION record_manuscript_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID;
BEGIN
  BEGIN
    actor := NULLIF(current_setting('app.changed_by_profile_id', true), '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    actor := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO manuscript_status_history (manuscript_id, from_status, to_status, changed_by_profile_id)
    VALUES (NEW.id, NULL, NEW.status, actor);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO manuscript_status_history (manuscript_id, from_status, to_status, changed_by_profile_id)
    VALUES (NEW.id, OLD.status, NEW.status, actor);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS manuscript_status_change_history ON manuscripts;
CREATE TRIGGER manuscript_status_change_history
  AFTER INSERT OR UPDATE OF status ON manuscripts
  FOR EACH ROW
  EXECUTE FUNCTION record_manuscript_status_change();

-- Backfill: one initial history row per existing manuscript ---------------
INSERT INTO manuscript_status_history (manuscript_id, from_status, to_status, created_at)
SELECT m.id, NULL, m.status, m.created_at
FROM manuscripts m
WHERE NOT EXISTS (
  SELECT 1 FROM manuscript_status_history h WHERE h.manuscript_id = m.id
);

-- RLS ---------------------------------------------------------------------
-- Enabled with no client policies: history is trigger-controlled.
-- Author-safe SELECT access is granted via a view in the RLS-hardening
-- migration (20260724000004).
ALTER TABLE manuscript_status_history ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON manuscript_status_history FROM anon;
REVOKE INSERT, UPDATE, DELETE ON manuscript_status_history FROM authenticated;

COMMENT ON TABLE manuscript_status_history IS
  'Immutable manuscript status transitions. Written only by triggers; corrections are new rows.';
