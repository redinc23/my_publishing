-- Create daily aggregated stats table
CREATE TABLE IF NOT EXISTS book_stats_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  
  -- View metrics
  views INTEGER DEFAULT 0,
  unique_views INTEGER DEFAULT 0,
  
  -- Reader metrics
  unique_users INTEGER DEFAULT 0,
  unique_sessions INTEGER DEFAULT 0,
  total_read_time INTEGER DEFAULT 0,
  avg_read_time INTEGER DEFAULT 0,
  
  -- Engagement metrics
  total_events INTEGER DEFAULT 0,
  completions INTEGER DEFAULT 0,
  completion_rate NUMERIC(5,2) DEFAULT 0,
  avg_engagement_score NUMERIC(5,2) DEFAULT 0,
  bounce_rate NUMERIC(5,2) DEFAULT 0,
  
  -- Purchase metrics
  purchases INTEGER DEFAULT 0,
  downloads INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  
  -- Geographic distribution
  countries_reached INTEGER DEFAULT 0,
  top_countries JSONB DEFAULT '[]'::jsonb,
  
  -- Device distribution
  mobile_percentage NUMERIC(5,2) DEFAULT 0,
  tablet_percentage NUMERIC(5,2) DEFAULT 0,
  desktop_percentage NUMERIC(5,2) DEFAULT 0,
  
  -- Traffic sources
  direct_traffic INTEGER DEFAULT 0,
  referral_traffic INTEGER DEFAULT 0,
  social_traffic INTEGER DEFAULT 0,
  search_traffic INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(date, book_id)
);

-- Indexes
CREATE INDEX idx_book_stats_daily_date 
  ON book_stats_daily(date DESC);

CREATE INDEX idx_book_stats_daily_book 
  ON book_stats_daily(book_id, date DESC);

-- Row Level Security
ALTER TABLE book_stats_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can view stats for their books"
  ON book_stats_daily
  FOR SELECT
  USING (
    book_id IN (
      SELECT id FROM books WHERE author_id = auth.uid()
    )
  );

-- Function to refresh daily stats
CREATE OR REPLACE FUNCTION refresh_book_stats_daily(target_date DATE, target_book_id UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM book_stats_daily 
  WHERE date = target_date AND book_id = target_book_id;
  
  INSERT INTO book_stats_daily (
    date,
    book_id,
    views,
    unique_views,
    unique_users,
    unique_sessions,
    total_read_time,
    avg_read_time,
    total_events,
    completions,
    purchases,
    downloads,
    shares,
    countries_reached,
    mobile_percentage,
    tablet_percentage,
    desktop_percentage
  )
  SELECT
    target_date,
    target_book_id,
    COUNT(*) FILTER (WHERE event_type = 'view'),
    COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'view'),
    COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL),
    COUNT(DISTINCT session_id),
    SUM(COALESCE(time_spent, 0)),
    AVG(COALESCE(time_spent, 0))::INTEGER,
    COUNT(*),
    COUNT(*) FILTER (WHERE reading_progress >= 95),
    COUNT(*) FILTER (WHERE event_type = 'purchase'),
    COUNT(*) FILTER (WHERE event_type = 'download'),
    COUNT(*) FILTER (WHERE event_type = 'share'),
    COUNT(DISTINCT country_code),
    (COUNT(*) FILTER (WHERE device_type = 'mobile')::NUMERIC / NULLIF(COUNT(*), 0) * 100)::NUMERIC(5,2),
    (COUNT(*) FILTER (WHERE device_type = 'tablet')::NUMERIC / NULLIF(COUNT(*), 0) * 100)::NUMERIC(5,2),
    (COUNT(*) FILTER (WHERE device_type = 'desktop')::NUMERIC / NULLIF(COUNT(*), 0) * 100)::NUMERIC(5,2)
  FROM analytics_events
  WHERE 
    DATE(created_at) = target_date
    AND book_id = target_book_id
  HAVING COUNT(*) > 0;
END;
$$ LANGUAGE plpgsql;