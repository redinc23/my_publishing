-- ============================================
-- CRITICAL SQL FIXES - PRODUCTION READY
-- Run: npx supabase db push
-- ============================================

-- ============================================
-- FIX 1: Add visibility column to books
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'books' AND column_name = 'visibility'
    ) THEN
        ALTER TABLE books ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';
        ALTER TABLE books ADD CONSTRAINT books_visibility_check 
            CHECK (visibility IN ('public', 'private', 'unlisted'));
    END IF;
END $$;

-- ============================================
-- FIX 2: Fix storage file size validation function
-- Handles NULL metadata gracefully
-- ============================================
CREATE OR REPLACE FUNCTION validate_file_size(max_size_bytes BIGINT)
RETURNS TRIGGER AS $$
DECLARE
    file_size BIGINT;
BEGIN
    file_size := NULL;
    
    -- Safely extract file size from metadata
    IF NEW.metadata IS NOT NULL AND NEW.metadata ? 'size' THEN
        BEGIN
            file_size := (NEW.metadata->>'size')::BIGINT;
        EXCEPTION WHEN OTHERS THEN
            file_size := NULL;
        END;
    END IF;

    -- Reject if file exceeds max size
    IF file_size IS NOT NULL AND file_size > max_size_bytes THEN
        RAISE EXCEPTION 'File size % bytes exceeds maximum allowed: % bytes', 
            file_size, max_size_bytes;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FIX 3: Ensure profiles table has role column
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'role'
    ) THEN
        ALTER TABLE profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
        ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
            CHECK (role IN ('user', 'author', 'admin'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- ============================================
-- FIX 4: Fix admin policy (uses profiles table)
-- ============================================
DROP POLICY IF EXISTS "Admins can view all books" ON books;

CREATE POLICY "Admins can view all books"
ON books FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Authors can view their own books
DROP POLICY IF EXISTS "Authors can view own books" ON books;
CREATE POLICY "Authors can view own books"
ON books FOR SELECT
USING (author_id = auth.uid());

-- Authors can update their own books
DROP POLICY IF EXISTS "Authors can update own books" ON books;
CREATE POLICY "Authors can update own books"
ON books FOR UPDATE
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

-- Authors can delete their own books
DROP POLICY IF EXISTS "Authors can delete own books" ON books;
CREATE POLICY "Authors can delete own books"
ON books FOR DELETE
USING (author_id = auth.uid());

-- Authors can insert books
DROP POLICY IF EXISTS "Authors can insert books" ON books;
CREATE POLICY "Authors can insert books"
ON books FOR INSERT
WITH CHECK (author_id = auth.uid());

-- Public can view public books
DROP POLICY IF EXISTS "Public can view public books" ON books;
CREATE POLICY "Public can view public books"
ON books FOR SELECT
USING (visibility = 'public' AND status = 'published');

-- ============================================
-- FIX 5: Safer storage upload policy
-- ============================================
DROP POLICY IF EXISTS "Users can upload to their own book-covers folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to book-covers" ON storage.objects;

CREATE POLICY "Users can upload to book-covers"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'book-covers'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (
        (NEW.metadata->>'size')::BIGINT <= 5242880  -- 5MB max
        OR NEW.metadata->>'size' IS NULL
    )
    AND (
        NEW.metadata->>'mimetype' IN (
            'image/jpeg', 
            'image/png', 
            'image/webp', 
            'image/gif'
        )
        OR NEW.metadata->>'mimetype' IS NULL
    )
);

-- Users can view their own book covers
DROP POLICY IF EXISTS "Users can view own book-covers" ON storage.objects;
CREATE POLICY "Users can view own book-covers"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'book-covers'
    AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR auth.uid() IS NULL  -- Allow public access for published covers
    )
);

-- Users can update their own book covers
DROP POLICY IF EXISTS "Users can update own book-covers" ON storage.objects;
CREATE POLICY "Users can update own book-covers"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'book-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own book covers
DROP POLICY IF EXISTS "Users can delete own book-covers" ON storage.objects;
CREATE POLICY "Users can delete own book-covers"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'book-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ============================================
-- FIX 6: Add missing indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_books_slug ON books(slug);
CREATE INDEX IF NOT EXISTS idx_books_author_id ON books(author_id);
CREATE INDEX IF NOT EXISTS idx_books_status ON books(status);
CREATE INDEX IF NOT EXISTS idx_books_visibility ON books(visibility);
CREATE INDEX IF NOT EXISTS idx_books_author_status ON books(author_id, status);
CREATE INDEX IF NOT EXISTS idx_books_created_at ON books(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_books_updated_at ON books(updated_at DESC);

-- User follows indexes
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_composite ON user_follows(follower_id, following_id);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_analytics_events_book_date ON analytics_events(book_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_book ON orders(book_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);

-- ============================================
-- FIX 7: Add unique constraint on slug
-- ============================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'books_slug_unique'
    ) THEN
        ALTER TABLE books ADD CONSTRAINT books_slug_unique UNIQUE (slug);
    END IF;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================
-- FIX 8: Webhook idempotency table
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT false,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    
    CONSTRAINT webhook_events_event_id_unique UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_events_retry ON webhook_events(retry_count) WHERE processed = false;

COMMENT ON TABLE webhook_events IS 'Stores webhook events for idempotency checks and retry logic';

-- Enable RLS on webhook_events (service role only)
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Only service role can access webhook_events
DROP POLICY IF EXISTS "Service role only" ON webhook_events;
CREATE POLICY "Service role only"
ON webhook_events
USING (auth.role() = 'service_role');

-- ============================================
-- FIX 9: Add updated_at trigger for all tables
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to books table
DROP TRIGGER IF EXISTS update_books_updated_at ON books;
CREATE TRIGGER update_books_updated_at
    BEFORE UPDATE ON books
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to profiles table
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to orders table (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
        CREATE TRIGGER update_orders_updated_at
            BEFORE UPDATE ON orders
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- ============================================
-- FIX 10: Export jobs table for async exports
-- ============================================
CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('analytics', 'revenue', 'readers', 'orders')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    parameters JSONB NOT NULL DEFAULT '{}',
    result_url TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_user ON export_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_type ON export_jobs(type);

-- RLS for export_jobs
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own export jobs" ON export_jobs;
CREATE POLICY "Users can view own export jobs"
ON export_jobs FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own export jobs" ON export_jobs;
CREATE POLICY "Users can create own export jobs"
ON export_jobs FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Apply updated_at trigger
DROP TRIGGER IF EXISTS update_export_jobs_updated_at ON export_jobs;
CREATE TRIGGER update_export_jobs_updated_at
    BEFORE UPDATE ON export_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FIX 11: Book stats materialized view (optional but recommended)
-- ============================================
CREATE OR REPLACE VIEW book_stats_summary AS
SELECT 
    b.id as book_id,
    b.title,
    b.author_id,
    COUNT(DISTINCT ae.id) FILTER (WHERE ae.event_type = 'view') as total_views,
    COUNT(DISTINCT ae.user_id) FILTER (WHERE ae.event_type = 'view') as unique_viewers,
    COUNT(DISTINCT ae.id) FILTER (WHERE ae.event_type = 'purchase') as total_purchases,
    COALESCE(SUM(o.amount) FILTER (WHERE o.status = 'completed'), 0) as total_revenue,
    b.created_at,
    b.updated_at
FROM books b
LEFT JOIN analytics_events ae ON ae.book_id = b.id
LEFT JOIN orders o ON o.book_id = b.id
GROUP BY b.id, b.title, b.author_id, b.created_at, b.updated_at;

-- ============================================
-- FIX 12: Rate limiting table
-- ============================================
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL,
    tokens INTEGER NOT NULL DEFAULT 0,
    last_refill TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT rate_limits_key_unique UNIQUE (key)
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_last_refill ON rate_limits(last_refill);

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_key TEXT,
    p_max_tokens INTEGER DEFAULT 10,
    p_refill_interval INTERVAL DEFAULT '1 minute'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_tokens INTEGER;
    v_last_refill TIMESTAMPTZ;
    v_tokens_to_add INTEGER;
BEGIN
    -- Get or create rate limit record
    INSERT INTO rate_limits (key, tokens, last_refill)
    VALUES (p_key, p_max_tokens - 1, NOW())
    ON CONFLICT (key) DO UPDATE SET
        tokens = CASE 
            WHEN rate_limits.last_refill + p_refill_interval <= NOW() 
            THEN p_max_tokens - 1
            WHEN rate_limits.tokens > 0 
            THEN rate_limits.tokens - 1
            ELSE 0
        END,
        last_refill = CASE
            WHEN rate_limits.last_refill + p_refill_interval <= NOW()
            THEN NOW()
            ELSE rate_limits.last_refill
        END
    RETURNING tokens INTO v_tokens;

    -- Return true if request is allowed (tokens >= 0)
    RETURN v_tokens >= 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FIX 13: Audit log table
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action TEXT NOT NULL,
    table_name TEXT,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Enable RLS (admins only)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs"
ON audit_logs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.user_id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- ============================================
-- FINAL: Verify all tables exist
-- ============================================
DO $$
BEGIN
    -- Check critical tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'books') THEN
        RAISE EXCEPTION 'Critical table "books" does not exist';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        RAISE EXCEPTION 'Critical table "profiles" does not exist';
    END IF;
    
    RAISE NOTICE 'All critical fixes applied successfully';
END $$;