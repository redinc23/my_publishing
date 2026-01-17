-- Create analytics events table with partitioning support
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  device_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'read', 'purchase', 'download', 'share')),
  event_data JSONB DEFAULT '{}'::jsonb,
  
  -- User context
  ip_address INET,
  user_agent TEXT,
  referrer TEXT,
  
  -- Location
  country_code TEXT,
  region TEXT,
  city TEXT,
  
  -- Device info
  device_type TEXT CHECK (device_type IN ('mobile', 'tablet', 'desktop')),
  browser TEXT,
  os TEXT,
  
  -- Reading context (for 'read' events)
  chapter_id UUID REFERENCES book_chapters(id) ON DELETE SET NULL,
  chapter_number INTEGER,
  reading_progress NUMERIC(5,2),
  time_spent INTEGER,
  scroll_depth NUMERIC(5,2),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (created_at);

-- Create partitions for current and next year
CREATE TABLE analytics_events_2025 PARTITION OF analytics_events
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE analytics_events_2026 PARTITION OF analytics_events
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Create default partition for future dates
CREATE TABLE analytics_events_default PARTITION OF analytics_events DEFAULT;

-- Indexes for common queries
CREATE INDEX idx_analytics_events_book_date 
  ON analytics_events(book_id, created_at DESC);

CREATE INDEX idx_analytics_events_user_date 
  ON analytics_events(user_id, created_at DESC) 
  WHERE user_id IS NOT NULL;

CREATE INDEX idx_analytics_events_session 
  ON analytics_events(session_id, created_at DESC);

CREATE INDEX idx_analytics_events_type 
  ON analytics_events(event_type, created_at DESC);

CREATE INDEX idx_analytics_events_chapter 
  ON analytics_events(chapter_id, created_at DESC) 
  WHERE chapter_id IS NOT NULL;

-- Composite index for heatmap queries
CREATE INDEX idx_analytics_events_heatmap 
  ON analytics_events(book_id, chapter_number, created_at DESC) 
  WHERE event_type = 'read';

-- GIN index for event_data JSONB queries
CREATE INDEX idx_analytics_events_data 
  ON analytics_events USING GIN (event_data);

-- Row Level Security
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see analytics for their own books
CREATE POLICY "Authors can view analytics for their books"
  ON analytics_events
  FOR SELECT
  USING (
    book_id IN (
      SELECT id FROM books WHERE author_id = auth.uid()
    )
  );

-- Policy: Anyone can insert analytics (for tracking)
CREATE POLICY "Anyone can insert analytics events"
  ON analytics_events
  FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE analytics_events IS 'Stores all analytics events for books with partitioning by date';