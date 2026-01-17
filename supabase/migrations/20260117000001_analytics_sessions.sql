-- Create sessions table for aggregated session data
CREATE TABLE IF NOT EXISTS analytics_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  device_id TEXT,
  
  -- Session metadata
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  
  -- Session metrics
  total_events INTEGER DEFAULT 0,
  total_duration INTEGER DEFAULT 0,
  pages_viewed INTEGER DEFAULT 0,
  chapters_read INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  max_progress NUMERIC(5,2) DEFAULT 0,
  
  -- Engagement metrics
  is_active BOOLEAN DEFAULT true,
  engagement_score NUMERIC(5,2) DEFAULT 0,
  bounce_rate BOOLEAN DEFAULT false,
  
  -- Context
  entry_page TEXT,
  exit_page TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  
  -- Device info (from first event)
  device_type TEXT,
  browser TEXT,
  os TEXT,
  country_code TEXT,
  region TEXT,
  city TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sessions_book_date 
  ON analytics_sessions(book_id, created_at DESC);

CREATE INDEX idx_sessions_user_date 
  ON analytics_sessions(user_id, created_at DESC) 
  WHERE user_id IS NOT NULL;

CREATE INDEX idx_sessions_active 
  ON analytics_sessions(book_id, last_activity_at DESC) 
  WHERE is_active = true;

CREATE INDEX idx_sessions_session_id 
  ON analytics_sessions(session_id);

-- Row Level Security
ALTER TABLE analytics_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can view sessions for their books"
  ON analytics_sessions
  FOR SELECT
  USING (
    book_id IN (
      SELECT id FROM books WHERE author_id = auth.uid()
    )
  );

CREATE POLICY "System can manage sessions"
  ON analytics_sessions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to update session on new event
CREATE OR REPLACE FUNCTION update_analytics_session()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO analytics_sessions (
    session_id,
    book_id,
    user_id,
    device_id,
    last_activity_at,
    total_events,
    device_type,
    browser,
    os,
    country_code,
    region,
    city,
    referrer
  ) VALUES (
    NEW.session_id,
    NEW.book_id,
    NEW.user_id,
    NEW.device_id,
    NEW.created_at,
    1,
    NEW.device_type,
    NEW.browser,
    NEW.os,
    NEW.country_code,
    NEW.region,
    NEW.city,
    NEW.referrer
  )
  ON CONFLICT (session_id) DO UPDATE SET
    last_activity_at = NEW.created_at,
    total_events = analytics_sessions.total_events + 1,
    is_active = (NEW.created_at - analytics_sessions.last_activity_at) < INTERVAL '30 minutes',
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update sessions
CREATE TRIGGER trigger_update_session
  AFTER INSERT ON analytics_events
  FOR EACH ROW
  EXECUTE FUNCTION update_analytics_session();

-- Function to mark inactive sessions
CREATE OR REPLACE FUNCTION mark_inactive_sessions()
RETURNS void AS $$
BEGIN
  UPDATE analytics_sessions
  SET 
    is_active = false,
    ended_at = last_activity_at
  WHERE 
    is_active = true 
    AND last_activity_at < NOW() - INTERVAL '30 minutes';
END;
$$ LANGUAGE plpgsql;