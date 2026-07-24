-- ============================================================================
-- CREATE MANUSCRIPT REVIEWS (PR 1, migration 3/7)
-- ============================================================================
-- Editorial review records: reviewer, decision, author-visible feedback,
-- staff-only internal notes, and review rounds.
-- ============================================================================

CREATE TABLE IF NOT EXISTS manuscript_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manuscript_id UUID NOT NULL,
  reviewer_profile_id UUID NOT NULL,
  decision TEXT NOT NULL DEFAULT 'pending',
  author_feedback TEXT,
  internal_notes TEXT,
  review_round INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  CONSTRAINT manuscript_reviews_manuscript_id_fkey
    FOREIGN KEY (manuscript_id) REFERENCES manuscripts(id) ON DELETE CASCADE,
  CONSTRAINT manuscript_reviews_reviewer_profile_id_fkey
    FOREIGN KEY (reviewer_profile_id) REFERENCES profiles(id) ON DELETE RESTRICT,
  CONSTRAINT manuscript_reviews_decision_check CHECK (
    decision IN ('pending', 'changes_requested', 'accepted', 'rejected')
  ),
  CONSTRAINT manuscript_reviews_round_positive CHECK (review_round >= 1),
  CONSTRAINT manuscript_reviews_author_feedback_length CHECK (
    author_feedback IS NULL OR length(author_feedback) <= 10000
  ),
  CONSTRAINT manuscript_reviews_internal_notes_length CHECK (
    internal_notes IS NULL OR length(internal_notes) <= 20000
  ),
  CONSTRAINT manuscript_reviews_unique_round UNIQUE (manuscript_id, review_round)
);

-- updated_at maintenance (reuses the shared function from the initial schema)
DROP TRIGGER IF EXISTS update_manuscript_reviews_updated_at ON manuscript_reviews;
CREATE TRIGGER update_manuscript_reviews_updated_at
  BEFORE UPDATE ON manuscript_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS: enabled here; policies are defined in 20260724000004 so that all
-- manuscript policies live in one reviewed place.
ALTER TABLE manuscript_reviews ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON manuscript_reviews FROM anon;

COMMENT ON COLUMN manuscript_reviews.internal_notes IS
  'Admin/editor-only. Authors read feedback exclusively through the author_manuscript_feedback view.';
