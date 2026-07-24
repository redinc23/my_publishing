-- ============================================================================
-- ADD MANUSCRIPT WORKFLOW INDEXES (PR 1, migration 7/7)
-- ============================================================================
-- Basic manuscript indexes already exist (idx_manuscripts_author, _status,
-- _stage, _submission_date) — not recreated here.
-- ============================================================================

-- Admin review queue
CREATE INDEX IF NOT EXISTS idx_manuscripts_status_submitted_at
  ON manuscripts (status, submitted_at DESC);

-- Reviewer work queue
CREATE INDEX IF NOT EXISTS idx_manuscripts_assigned_reviewer_status
  ON manuscripts (assigned_reviewer_id, status);

-- Author project list
CREATE INDEX IF NOT EXISTS idx_manuscripts_author_updated_at
  ON manuscripts (author_id, updated_at DESC);

-- Active reviews (partial)
CREATE INDEX IF NOT EXISTS idx_manuscripts_active_review
  ON manuscripts (assigned_reviewer_id, review_started_at DESC)
  WHERE status = 'under_review';

-- One manuscript per created book (created in 20260724000003; asserted here)
CREATE UNIQUE INDEX IF NOT EXISTS manuscripts_book_id_unique
  ON manuscripts (book_id)
  WHERE book_id IS NOT NULL;

-- History timeline
CREATE INDEX IF NOT EXISTS idx_manuscript_history_manuscript_created
  ON manuscript_status_history (manuscript_id, created_at ASC);

-- Audit investigation
CREATE INDEX IF NOT EXISTS idx_manuscript_history_actor_created
  ON manuscript_status_history (changed_by_profile_id, created_at DESC);

-- Reviewer queue
CREATE INDEX IF NOT EXISTS idx_manuscript_reviews_reviewer_decision
  ON manuscript_reviews (reviewer_profile_id, decision, updated_at DESC);

-- Latest review lookup
CREATE INDEX IF NOT EXISTS idx_manuscript_reviews_manuscript_round
  ON manuscript_reviews (manuscript_id, review_round DESC);
