-- Fix author ownership policies to use authors + profiles mapping
-- Also adds soft delete support for books

-- ============================================================================
-- BOOKS: Add soft delete column
-- ============================================================================
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_books_deleted_at ON books(deleted_at);

-- ============================================================================
-- AUTHORS: RLS policies for author profiles
-- ============================================================================
ALTER TABLE authors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authors can view own profiles" ON authors;
DROP POLICY IF EXISTS "Authors can update own profiles" ON authors;
DROP POLICY IF EXISTS "Authors can insert own profiles" ON authors;
DROP POLICY IF EXISTS "Admins can view all authors" ON authors;

CREATE POLICY "Authors can view own profiles"
  ON authors
  FOR SELECT
  USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Authors can update own profiles"
  ON authors
  FOR UPDATE
  USING (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Authors can insert own profiles"
  ON authors
  FOR INSERT
  WITH CHECK (
    profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can view all authors"
  ON authors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- BOOKS: Author ownership policies
-- ============================================================================
DROP POLICY IF EXISTS "Authors can view own books" ON books;
DROP POLICY IF EXISTS "Authors can view their own books" ON books;
DROP POLICY IF EXISTS "Authors can update own books" ON books;
DROP POLICY IF EXISTS "Authors can update their own books" ON books;
DROP POLICY IF EXISTS "Authors can delete own books" ON books;
DROP POLICY IF EXISTS "Authors can insert books" ON books;

CREATE POLICY "Authors can view own books"
  ON books
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM authors a
      JOIN profiles p ON p.id = a.profile_id
      WHERE a.id = books.author_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Authors can update own books"
  ON books
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM authors a
      JOIN profiles p ON p.id = a.profile_id
      WHERE a.id = books.author_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM authors a
      JOIN profiles p ON p.id = a.profile_id
      WHERE a.id = books.author_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Authors can delete own books"
  ON books
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM authors a
      JOIN profiles p ON p.id = a.profile_id
      WHERE a.id = books.author_id
        AND p.user_id = auth.uid()
    )
  );

CREATE POLICY "Authors can insert books"
  ON books
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM authors a
      JOIN profiles p ON p.id = a.profile_id
      WHERE a.id = books.author_id
        AND p.user_id = auth.uid()
    )
  );

-- ============================================================================
-- ANALYTICS EVENTS: Author view policies
-- ============================================================================
DROP POLICY IF EXISTS "Authors can view analytics for their books" ON analytics_events;

CREATE POLICY "Authors can view analytics for their books"
  ON analytics_events
  FOR SELECT
  USING (
    book_id IN (
      SELECT b.id
      FROM books b
      JOIN authors a ON a.id = b.author_id
      JOIN profiles p ON p.id = a.profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- ============================================================================
-- ANALYTICS SESSIONS: Author view policies
-- ============================================================================
DROP POLICY IF EXISTS "Authors can view sessions for their books" ON analytics_sessions;

CREATE POLICY "Authors can view sessions for their books"
  ON analytics_sessions
  FOR SELECT
  USING (
    book_id IN (
      SELECT b.id
      FROM books b
      JOIN authors a ON a.id = b.author_id
      JOIN profiles p ON p.id = a.profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- ============================================================================
-- BOOK STATS: Author view policies
-- ============================================================================
DROP POLICY IF EXISTS "Authors can view stats for their books" ON book_stats_daily;

CREATE POLICY "Authors can view stats for their books"
  ON book_stats_daily
  FOR SELECT
  USING (
    book_id IN (
      SELECT b.id
      FROM books b
      JOIN authors a ON a.id = b.author_id
      JOIN profiles p ON p.id = a.profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- ============================================================================
-- BOOK SALES: Author view policies
-- ============================================================================
DROP POLICY IF EXISTS "Authors can view sales for their books" ON book_sales;

CREATE POLICY "Authors can view sales for their books"
  ON book_sales
  FOR SELECT
  USING (
    book_id IN (
      SELECT b.id
      FROM books b
      JOIN authors a ON a.id = b.author_id
      JOIN profiles p ON p.id = a.profile_id
      WHERE p.user_id = auth.uid()
    )
  );

-- ============================================================================
-- BOOK PRICING: Author management policies
-- ============================================================================
DROP POLICY IF EXISTS "Authors can manage pricing for their books" ON book_pricing;

CREATE POLICY "Authors can manage pricing for their books"
  ON book_pricing
  FOR ALL
  USING (
    book_id IN (
      SELECT b.id
      FROM books b
      JOIN authors a ON a.id = b.author_id
      JOIN profiles p ON p.id = a.profile_id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    book_id IN (
      SELECT b.id
      FROM books b
      JOIN authors a ON a.id = b.author_id
      JOIN profiles p ON p.id = a.profile_id
      WHERE p.user_id = auth.uid()
    )
  );
