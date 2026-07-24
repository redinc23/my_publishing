-- Reader engagement tables shipped by the launch batches were applied to
-- production out-of-band. Record their contract here so new environments and
-- production converge on the same schema. This migration is idempotent.

CREATE TABLE IF NOT EXISTS public.bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  position TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bookmarks_user_id_book_id_position_key UNIQUE (user_id, book_id, position)
);

CREATE TABLE IF NOT EXISTS public.highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  selected_text TEXT NOT NULL,
  position TEXT,
  color TEXT NOT NULL DEFAULT 'yellow'
    CHECK (color IN ('yellow', 'green', 'blue', 'pink', 'orange')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wishlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT wishlist_user_id_book_id_key UNIQUE (user_id, book_id)
);

CREATE TABLE IF NOT EXISTS public.author_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.authors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT author_follows_user_id_author_id_key UNIQUE (user_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user_book
  ON public.bookmarks (user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user_book
  ON public.highlights (user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user_notes
  ON public.highlights (user_id) WHERE note IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wishlist_user
  ON public.wishlist (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wishlist_book
  ON public.wishlist (book_id);
CREATE INDEX IF NOT EXISTS idx_author_follows_user
  ON public.author_follows (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_author_follows_author
  ON public.author_follows (author_id);

ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can create own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can update own bookmarks" ON public.bookmarks;
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON public.bookmarks;
CREATE POLICY "Users can view own bookmarks" ON public.bookmarks
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can create own bookmarks" ON public.bookmarks
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update own bookmarks" ON public.bookmarks
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own highlights" ON public.highlights;
DROP POLICY IF EXISTS "Users can create own highlights" ON public.highlights;
DROP POLICY IF EXISTS "Users can update own highlights" ON public.highlights;
DROP POLICY IF EXISTS "Users can delete own highlights" ON public.highlights;
CREATE POLICY "Users can view own highlights" ON public.highlights
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can create own highlights" ON public.highlights
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can update own highlights" ON public.highlights
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can delete own highlights" ON public.highlights
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own wishlist" ON public.wishlist;
DROP POLICY IF EXISTS "Users can add to own wishlist" ON public.wishlist;
DROP POLICY IF EXISTS "Users can remove from own wishlist" ON public.wishlist;
CREATE POLICY "Users can view own wishlist" ON public.wishlist
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can add to own wishlist" ON public.wishlist
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can remove from own wishlist" ON public.wishlist
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own author follows" ON public.author_follows;
DROP POLICY IF EXISTS "Users can follow authors" ON public.author_follows;
DROP POLICY IF EXISTS "Users can unfollow authors" ON public.author_follows;
CREATE POLICY "Users can view own author follows" ON public.author_follows
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can follow authors" ON public.author_follows
  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can unfollow authors" ON public.author_follows
  FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.bookmarks, public.highlights, public.wishlist, public.author_follows
  FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookmarks, public.highlights
  TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.wishlist, public.author_follows
  TO authenticated;
GRANT ALL ON public.bookmarks, public.highlights, public.wishlist, public.author_follows
  TO service_role;

DROP TRIGGER IF EXISTS set_highlights_updated_at ON public.highlights;
CREATE TRIGGER set_highlights_updated_at
  BEFORE UPDATE ON public.highlights
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
