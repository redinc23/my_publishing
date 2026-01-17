-- Enhanced migration: Add performance indexes and optimizations
-- Note: Partitions are created in the analytics_events migration

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_analytics_events_book_date ON analytics_events(book_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_date ON analytics_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_book ON analytics_events(user_id, book_id, created_at DESC);

-- Create partial indexes for active data
CREATE INDEX IF NOT EXISTS idx_analytics_events_recent ON analytics_events(created_at DESC)
WHERE created_at > NOW() - INTERVAL '30 days';

-- Optimize book_stats_daily with better aggregation
CREATE OR REPLACE FUNCTION update_book_stats_daily()
RETURNS trigger AS $$
BEGIN
  -- Update materialized view asynchronously
  PERFORM pg_notify('refresh_book_stats', '');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_book_stats
AFTER INSERT ON analytics_events
FOR EACH STATEMENT
EXECUTE FUNCTION update_book_stats_daily();

-- Note: refresh_book_stats_incremental function is defined in book_stats_materialized migration

-- Add full-text search for better analytics search
ALTER TABLE analytics_events ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', COALESCE(event_type, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(country_code, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(device_type, '')), 'C')
) STORED;

CREATE INDEX idx_analytics_events_search ON analytics_events USING GIN(search_vector);

-- Note: For TimescaleDB compression, uncomment and configure:
-- SELECT add_compression_policy('analytics_events', INTERVAL '30 days');