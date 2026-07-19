-- ============================================================================
-- Review enhancements (public launch)
--   1. reviews.verified_purchase flag (set server-side from completed orders)
--   2. Author reply columns on reviews (one reply per review, by book author)
--   3. review_votes table guaranteed + RLS policies for reviews & review_votes
--   4. Indexes for the public reviews API access patterns
--   5. Trigger keeping reviews.helpful_count in sync with review_votes
-- Idempotent: safe to run multiple times.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1+2. New columns on reviews
-- ---------------------------------------------------------------------------
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS verified_purchase BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS author_reply TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS author_reply_at TIMESTAMPTZ;

COMMENT ON COLUMN reviews.verified_purchase IS
  'True when the reviewer has a completed order containing this book (set server-side only).';
COMMENT ON COLUMN reviews.author_reply IS
  'Optional public reply written by the book author. NULL = no reply.';
COMMENT ON COLUMN reviews.author_reply_at IS
  'Timestamp of the latest author reply.';

-- ---------------------------------------------------------------------------
-- 3. review_votes (helpful votes) — table already created in
--    20260122000000_social_features.sql; this guards environments where that
--    migration was not applied.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    is_helpful BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(review_id, user_id)
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_votes ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS policies
-- Direct (anon/authenticated) table access was previously denied outright
-- (RLS enabled, zero policies; all reads/writes went through the service
-- role). These policies open the minimum surface the public API needs.
-- ---------------------------------------------------------------------------

-- reviews: anyone can read public reviews
DROP POLICY IF EXISTS reviews_public_read ON reviews;
CREATE POLICY reviews_public_read ON reviews
    FOR SELECT
    USING (is_public = true);

-- reviews: owners can always read their own review (even if private)
DROP POLICY IF EXISTS reviews_owner_read ON reviews;
CREATE POLICY reviews_owner_read ON reviews
    FOR SELECT
    USING (auth.uid() = user_id);

-- reviews: authenticated users insert only their own rows
DROP POLICY IF EXISTS reviews_owner_insert ON reviews;
CREATE POLICY reviews_owner_insert ON reviews
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- reviews: owners update their own rows; author-reply / verified_purchase
-- fields are only ever written through the service role.
DROP POLICY IF EXISTS reviews_owner_update ON reviews;
CREATE POLICY reviews_owner_update ON reviews
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- reviews: owners delete their own rows
DROP POLICY IF EXISTS reviews_owner_delete ON reviews;
CREATE POLICY reviews_owner_delete ON reviews
    FOR DELETE
    USING (auth.uid() = user_id);

-- review_votes: users read their own votes (needed to render vote state)
DROP POLICY IF EXISTS review_votes_owner_read ON review_votes;
CREATE POLICY review_votes_owner_read ON review_votes
    FOR SELECT
    USING (auth.uid() = user_id);

-- review_votes: users insert their own votes
DROP POLICY IF EXISTS review_votes_owner_insert ON review_votes;
CREATE POLICY review_votes_owner_insert ON review_votes
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- review_votes: users update their own votes
DROP POLICY IF EXISTS review_votes_owner_update ON review_votes;
CREATE POLICY review_votes_owner_update ON review_votes
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- review_votes: users delete (un-cast) their own votes
DROP POLICY IF EXISTS review_votes_owner_delete ON review_votes;
CREATE POLICY review_votes_owner_delete ON review_votes
    FOR DELETE
    USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reviews_book_public
    ON reviews (book_id, is_public, helpful_count DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_book_rating
    ON reviews (book_id, rating)
    WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_review_votes_user ON review_votes (user_id);
CREATE INDEX IF NOT EXISTS idx_review_votes_review ON review_votes (review_id);

-- ---------------------------------------------------------------------------
-- 5. Keep reviews.helpful_count in sync with review_votes at the DB level so
--    counts stay correct regardless of which code path writes a vote.
--    SECURITY DEFINER + fixed search_path (hard requirement post-C8 audit).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_review_helpful_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_review_id UUID := COALESCE(NEW.review_id, OLD.review_id);
BEGIN
    UPDATE reviews
    SET helpful_count = (
        SELECT COUNT(*)
        FROM review_votes
        WHERE review_votes.review_id = target_review_id
          AND review_votes.is_helpful = true
    )
    WHERE id = target_review_id;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_helpful_count_on_vote ON review_votes;
CREATE TRIGGER sync_helpful_count_on_vote
    AFTER INSERT OR UPDATE OR DELETE ON review_votes
    FOR EACH ROW
    EXECUTE FUNCTION sync_review_helpful_count();

-- Function executes as owner; direct calls are not part of the public surface.
REVOKE EXECUTE ON FUNCTION sync_review_helpful_count() FROM PUBLIC, anon, authenticated;
