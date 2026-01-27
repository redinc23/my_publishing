-- Book search RPC
CREATE OR REPLACE FUNCTION books_search(
  search_query TEXT,
  language TEXT DEFAULT NULL,
  "minRating" NUMERIC DEFAULT NULL,
  category TEXT DEFAULT NULL,
  tag TEXT DEFAULT NULL,
  "limit" INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  subtitle TEXT,
  author_name TEXT,
  cover_url TEXT,
  average_rating NUMERIC,
  relevance REAL,
  match_snippet TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.id,
    b.title,
    NULL::TEXT AS subtitle,
    COALESCE(a.pen_name, 'Unknown Author') AS author_name,
    b.cover_url,
    b.average_rating,
    ts_rank(b.search_vector, websearch_to_tsquery('english', search_query)) AS relevance,
    ts_headline('english', b.description, websearch_to_tsquery('english', search_query)) AS match_snippet
  FROM books b
  LEFT JOIN authors a ON b.author_id = a.id
  WHERE b.search_vector @@ websearch_to_tsquery('english', search_query)
    AND b.status = 'published'
    AND b.visibility = 'public'
    AND b.deleted_at IS NULL
    AND (language IS NULL OR b.language = language)
    AND ("minRating" IS NULL OR b.average_rating >= "minRating")
    AND (category IS NULL OR b.genre = category OR category = ANY(b.subgenres))
    AND (tag IS NULL OR tag = ANY(b.subgenres))
  ORDER BY relevance DESC
  LIMIT COALESCE("limit", 20);
$$;

-- Align book_stats to daily materialization (monthly rollup)
CREATE OR REPLACE VIEW book_stats AS
SELECT
  book_id,
  date_trunc('month', date)::DATE AS month,
  SUM(views)::INTEGER AS views,
  SUM(downloads)::INTEGER AS downloads
FROM book_stats_daily
GROUP BY book_id, date_trunc('month', date);

-- Book view cache for rate limiting
CREATE TABLE IF NOT EXISTS book_view_cache (
  cache_key TEXT PRIMARY KEY,
  last_viewed TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_view_cache_last_viewed
  ON book_view_cache(last_viewed DESC);

-- Book views log
CREATE TABLE IF NOT EXISTS book_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_book_views_book_id
  ON book_views(book_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_book_views_user_id
  ON book_views(user_id, viewed_at DESC);

-- View count support
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_view_count(book_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE books
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = book_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

-- Row Level Security
ALTER TABLE book_view_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow cache read"
  ON book_view_cache FOR SELECT
  USING (true);

CREATE POLICY "Allow cache write"
  ON book_view_cache FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow cache update"
  ON book_view_cache FOR UPDATE
  USING (true);

CREATE POLICY "Allow book view inserts"
  ON book_views FOR INSERT
  WITH CHECK (true);
