-- ============================================================================
-- EXPAND MANUSCRIPT WORKFLOW (PR 1, migration 1/7)
-- ============================================================================
-- Normalizes the manuscript editorial workflow on the existing table:
--   * reviewer assignment + workflow timestamps
--   * author/internal notes, version number, canonical submitted_at
--   * canonical 8-status vocabulary (removes legacy 'published')
--   * data-validation constraints
-- Existing production data is preserved and backfilled.
-- ============================================================================

-- 1) New columns ------------------------------------------------------------
ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS assigned_reviewer_id UUID;
ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS review_started_at TIMESTAMPTZ;
ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS decision_at TIMESTAMPTZ;
ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ;
ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;
ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS author_notes TEXT;
ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS internal_notes TEXT;
ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- 2) Reviewer foreign key ---------------------------------------------------
-- References profiles (application identity + role source), NOT auth.users.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'manuscripts_assigned_reviewer_id_fkey'
  ) THEN
    ALTER TABLE manuscripts
      ADD CONSTRAINT manuscripts_assigned_reviewer_id_fkey
      FOREIGN KEY (assigned_reviewer_id) REFERENCES profiles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- 3) Timestamp backfill (before constraint swap) ----------------------------
UPDATE manuscripts
SET submitted_at = COALESCE(submission_date, created_at)
WHERE status <> 'draft'
  AND submitted_at IS NULL;

-- NOTE: submission_date is retained in PR 1 for compatibility and is
-- DEPRECATED in favor of submitted_at. Removal happens in a later migration
-- once application code reads submitted_at exclusively.

-- 4) Migrate legacy 'published' manuscript status ---------------------------
-- 'published' belongs to books.status, not manuscript editorial status.
UPDATE manuscripts
SET status = 'converted_to_book'
WHERE status = 'published';

-- 5) Replace the status constraint ------------------------------------------
-- Discover the existing (possibly anonymous) status CHECK constraint by
-- definition, then drop it and add the canonical named constraint.
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'manuscripts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%IN%'
  LOOP
    EXECUTE format('ALTER TABLE manuscripts DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE manuscripts
  ADD CONSTRAINT manuscripts_status_check
  CHECK (
    status IN (
      'draft',
      'submitted',
      'under_review',
      'revisions_requested',
      'accepted',
      'rejected',
      'withdrawn',
      'converted_to_book'
    )
  );

-- 6) Data-validation constraints --------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manuscripts_word_count_positive') THEN
    ALTER TABLE manuscripts ADD CONSTRAINT manuscripts_word_count_positive
      CHECK (word_count IS NULL OR word_count > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manuscripts_version_number_positive') THEN
    ALTER TABLE manuscripts ADD CONSTRAINT manuscripts_version_number_positive
      CHECK (version_number >= 1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manuscripts_title_not_blank') THEN
    ALTER TABLE manuscripts ADD CONSTRAINT manuscripts_title_not_blank
      CHECK (length(trim(title)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manuscripts_genre_not_blank') THEN
    ALTER TABLE manuscripts ADD CONSTRAINT manuscripts_genre_not_blank
      CHECK (length(trim(genre)) > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manuscripts_synopsis_length') THEN
    ALTER TABLE manuscripts ADD CONSTRAINT manuscripts_synopsis_length
      CHECK (synopsis IS NULL OR length(synopsis) <= 5000);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manuscripts_target_audience_length') THEN
    ALTER TABLE manuscripts ADD CONSTRAINT manuscripts_target_audience_length
      CHECK (target_audience IS NULL OR length(target_audience) <= 500);
  END IF;
END $$;

-- The existing update_manuscripts_updated_at trigger (initial schema) remains
-- active and is intentionally untouched.

COMMENT ON COLUMN manuscripts.submission_date IS
  'DEPRECATED: use submitted_at. Retained for compatibility during PR 1.';
COMMENT ON COLUMN manuscripts.internal_notes IS
  'Staff-only notes. Never exposed to authors (see author-safe views).';
