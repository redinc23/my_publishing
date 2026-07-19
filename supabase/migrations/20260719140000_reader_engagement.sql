-- ============================================================================
-- READER ENGAGEMENT LAYER
-- bookmarks / highlights+notes / wishlist / author follows
-- Idempotent: safe to re-run. Every table is RLS-enabled with owner-only
-- policies. user_id references auth.users(id) directly, matching the
-- social_features layer (reading_lists, user_follows).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- BOOKMARKS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  -- Reader locator: epub CFI, page number, or scroll anchor — opaque to the DB.
  position TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, book_id, position)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON public.bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_book ON public.bookmarks(user_id, book_id);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can view own bookmarks" ON public.bookmarks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can create own bookmarks" ON public.bookmarks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can update own bookmarks" ON public.bookmarks
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- HIGHLIGHTS (with optional note text)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  selected_text TEXT NOT NULL,
  -- Reader locator (epub CFI / anchor). Nullable: a highlight is still valid
  -- without a stable locator.
  position TEXT,
  color TEXT NOT NULL DEFAULT 'yellow'
    CHECK (color IN ('yellow', 'green', 'blue', 'pink', 'orange')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_highlights_user ON public.highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user_book ON public.highlights(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user_notes
  ON public.highlights(user_id) WHERE note IS NOT NULL;

ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own highlights" ON public.highlights;
CREATE POLICY "Users can view own highlights" ON public.highlights
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own highlights" ON public.highlights;
CREATE POLICY "Users can create own highlights" ON public.highlights
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own highlights" ON public.highlights;
CREATE POLICY "Users can update own highlights" ON public.highlights
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own highlights" ON public.highlights;
CREATE POLICY "Users can delete own highlights" ON public.highlights
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- updated_at trigger (function update_updated_at_column() already exists)
DROP TRIGGER IF EXISTS update_highlights_updated_at ON public.highlights;
CREATE TRIGGER update_highlights_updated_at
  BEFORE UPDATE ON public.highlights
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------------------
-- WISHLIST
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user ON public.wishlist(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishlist_book ON public.wishlist(book_id);

ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own wishlist" ON public.wishlist;
CREATE POLICY "Users can view own wishlist" ON public.wishlist
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can add to own wishlist" ON public.wishlist;
CREATE POLICY "Users can add to own wishlist" ON public.wishlist
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove from own wishlist" ON public.wishlist;
CREATE POLICY "Users can remove from own wishlist" ON public.wishlist
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- AUTHOR FOLLOWS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.author_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.authors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_author_follows_user ON public.author_follows(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_author_follows_author ON public.author_follows(author_id);

ALTER TABLE public.author_follows ENABLE ROW LEVEL SECURITY;

-- Owner-only reads: follower counts are aggregated server-side (service role)
-- so per-user follow graphs are never exposed to other users.
DROP POLICY IF EXISTS "Users can view own author follows" ON public.author_follows;
CREATE POLICY "Users can view own author follows" ON public.author_follows
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can follow authors" ON public.author_follows;
CREATE POLICY "Users can follow authors" ON public.author_follows
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can unfollow authors" ON public.author_follows;
CREATE POLICY "Users can unfollow authors" ON public.author_follows
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
