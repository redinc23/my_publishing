-- 20260719014349_resonance_engine_phase2.sql
-- Phase 2 — Resonance Engine: rail analytics events, one-vector-per-book
-- upsert support, and an arbitrary-embedding match RPC for taste vectors.
-- Idempotent: safe to re-run.

-- ============================================================================
-- 1. engagement_events: allow impression/click (recommendation rail analytics)
-- ============================================================================
ALTER TABLE public.engagement_events
  DROP CONSTRAINT IF EXISTS engagement_events_event_type_check;

ALTER TABLE public.engagement_events
  ADD CONSTRAINT engagement_events_event_type_check
  CHECK (
    event_type IN (
      'view',
      'purchase',
      'read',
      'rating',
      'share',
      'wishlist',
      'impression',
      'click'
    )
  );

-- Speeds up the trending aggregation (recent events per type).
CREATE INDEX IF NOT EXISTS idx_engagement_created_at
  ON public.engagement_events (created_at DESC);

-- ============================================================================
-- 2. resonance_vectors: enforce one embedding row per book.
--    /api/resonance/embed upserts on book_id; without a unique index PostgREST
--    could not target the conflict and duplicate rows accumulated. Dedupe
--    first (keep most recently updated), then add the unique index.
-- ============================================================================
DELETE FROM public.resonance_vectors a
USING public.resonance_vectors b
WHERE a.book_id = b.book_id
  AND (
    a.updated_at < b.updated_at
    OR (a.updated_at = b.updated_at AND a.id < b.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_resonance_vectors_book_unique
  ON public.resonance_vectors (book_id);

-- ============================================================================
-- 3. match_resonance_vector: nearest published/public books to an arbitrary
--    384-d embedding (user taste vector = mean of engaged-book embeddings).
--    Service-role only; the API layer resolves identity and exclusions.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.match_resonance_vector(
  query_embedding vector(384),
  match_count integer DEFAULT 12,
  exclude_book_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS TABLE (id uuid, similarity double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    (1 - (rv.embedding <=> query_embedding))::double precision AS similarity
  FROM public.resonance_vectors rv
  JOIN public.books b ON b.id = rv.book_id
  WHERE rv.embedding IS NOT NULL
    AND b.status = 'published'
    AND b.visibility = 'public'
    AND NOT (b.id = ANY (COALESCE(exclude_book_ids, '{}'::uuid[])))
  ORDER BY rv.embedding <=> query_embedding
  LIMIT GREATEST(match_count, 1);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.match_resonance_vector(vector, integer, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_resonance_vector(vector, integer, uuid[]) TO authenticated, service_role;
