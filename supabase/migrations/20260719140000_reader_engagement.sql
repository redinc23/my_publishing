-- ============================================================================
-- READER ENGAGEMENT TABLES
--   * bookmarks          — one-tap saved positions in the reader
--   * highlights         — text selections with color coding + optional note
--   * wishlist           — books saved for later
--   * author_follows     — readers following authors
-- Every table:
--   * user_id references profiles(id) (NOT auth.users directly) so the RLS
--     policies match the existing "via profiles.user_id = auth.uid()" pattern.
--   * RLS enabled; owners get full CRUD on their own rows only.
--   * Idempotent: safe to run multiple times.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- BOOKMARKS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  -- EPUB CFI, scroll anchor, page number… format chosen by the reader client.
  position TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, book_id, position)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_book
  ON bookmarks(user_id, book_id, created_at DESC);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own bookmarks" ON bookmarks;
CREATE POLICY "Users can manage own bookmarks" ON bookmarks
  FOR ALL USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) WITH CHECK (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- HIGHLIGHTS (text selection + color + optional note)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  selected_text TEXT NOT NULL,
  -- EPUB CFI range / scroll anchor; NULL allowed for context-free snippets.
  position TEXT,
  color TEXT NOT NULL DEFAULT 'yellow'
    CHECK (color IN ('yellow', 'green', 'blue', 'pink', 'orange')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_highlights_user_book
  ON highlights(user_id, book_id, created_at DESC);
-- Readers Hub "Notes" tab (highlights that have a note attached).
CREATE INDEX IF NOT EXISTS idx_highlights_notes
  ON highlights(user_id, created_at DESC)
  WHERE note IS NOT NULL;

ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own highlights" ON highlights;
CREATE POLICY "Users can manage own highlights" ON highlights
  FOR ALL USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) WITH CHECK (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- Keep updated_at fresh when color/note change.
DROP TRIGGER IF EXISTS update_highlights_updated_at ON highlights;
CREATE TRIGGER update_highlights_updated_at
  BEFORE UPDATE ON highlights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- WISHLIST (books saved for later)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user
  ON wishlist(user_id, created_at DESC);

ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own wishlist" ON wishlist;
CREATE POLICY "Users can manage own wishlist" ON wishlist
  FOR ALL USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) WITH CHECK (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- AUTHOR FOLLOWS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS author_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_author_follows_user
  ON author_follows(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_author_follows_author
  ON author_follows(author_id);

ALTER TABLE author_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own follows" ON author_follows;
CREATE POLICY "Users can manage own follows" ON author_follows
  FOR ALL USING (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  ) WITH CHECK (
    user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- GRANTS
-- New public tables inherit default grants; make the intent explicit.
-- Owners reach rows through the RLS policies above with the session client.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.bookmarks FROM PUBLIC;
REVOKE ALL ON public.bookmarks FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookmarks TO authenticated;
GRANT ALL ON public.bookmarks TO service_role;

REVOKE ALL ON public.highlights FROM PUBLIC;
REVOKE ALL ON public.highlights FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.highlights TO authenticated;
GRANT ALL ON public.highlights TO service_role;

REVOKE ALL ON public.wishlist FROM PUBLIC;
REVOKE ALL ON public.wishlist FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist TO authenticated;
GRANT ALL ON public.wishlist TO service_role;

REVOKE ALL ON public.author_follows FROM PUBLIC;
REVOKE ALL ON public.author_follows FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.author_follows TO authenticated;
GRANT ALL ON public.author_follows TO service_role;
