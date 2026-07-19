-- ============================================================================
-- LISTENING_PROGRESS TABLE (audiobook playback position sync)
-- ============================================================================
-- Mirrors the reading_progress conventions:
--   * user_id references profiles(id) (NOT auth.users directly) so the RLS
--     policies match the existing "via profiles.user_id = auth.uid()" pattern.
--   * Composite PK (user_id, book_id) — one progress row per listener per book.
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS listening_progress (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  position_seconds INTEGER NOT NULL DEFAULT 0 CHECK (position_seconds >= 0),
  duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, book_id)
);

-- Fast "recently listened" lookups per profile (PK already covers user_id).
CREATE INDEX IF NOT EXISTS idx_listening_progress_updated
  ON listening_progress(user_id, updated_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE listening_progress ENABLE ROW LEVEL SECURITY;

-- DROP + CREATE keeps the migration idempotent (CREATE POLICY IF NOT EXISTS
-- is not supported by Postgres).
DROP POLICY IF EXISTS "Users can view own listening progress" ON listening_progress;
CREATE POLICY "Users can view own listening progress" ON listening_progress
  FOR SELECT USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert own listening progress" ON listening_progress;
CREATE POLICY "Users can insert own listening progress" ON listening_progress
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own listening progress" ON listening_progress;
CREATE POLICY "Users can update own listening progress" ON listening_progress
  FOR UPDATE USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) WITH CHECK (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete own listening progress" ON listening_progress;
CREATE POLICY "Users can delete own listening progress" ON listening_progress
  FOR DELETE USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Keep the surface locked down: no direct privileges for anonymous clients.
-- (New public tables inherit default grants; make the intent explicit.)
REVOKE ALL ON public.listening_progress FROM PUBLIC;
REVOKE ALL ON public.listening_progress FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listening_progress TO authenticated;
GRANT ALL ON public.listening_progress TO service_role;
