-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'reader' CHECK (role IN ('reader', 'author', 'partner', 'admin')),
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'basic', 'premium', 'institution')),
  preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- AUTHORS TABLE
-- ============================================================================
CREATE TABLE authors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  pen_name TEXT NOT NULL,
  bio TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  total_books INTEGER DEFAULT 0,
  royalty_rate DECIMAL(5,2) DEFAULT 50.00,
  photo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- BOOKS TABLE
-- ============================================================================
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  isbn TEXT UNIQUE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  cover_url TEXT,
  trailer_vimeo_id TEXT,
  genre TEXT NOT NULL,
  subgenres TEXT[],
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_price DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'review', 'accepted', 'published', 'archived')),
  visibility TEXT DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  is_featured BOOLEAN DEFAULT FALSE,
  featured_at TIMESTAMPTZ,
  total_reads INTEGER DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0 CHECK (average_rating >= 0 AND average_rating <= 5),
  page_count INTEGER,
  word_count INTEGER,
  author_id UUID REFERENCES authors(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(genre, '')), 'C')
  ) STORED
);

-- ============================================================================
-- BOOK_CONTENT TABLE
-- ============================================================================
CREATE TABLE book_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  epub_url TEXT,
  pdf_url TEXT,
  audio_url TEXT,
  toc JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- READING_SESSIONS TABLE
-- ============================================================================
CREATE TABLE reading_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  duration INTEGER DEFAULT 0,
  pages_read INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

-- ============================================================================
-- READING_PROGRESS TABLE
-- ============================================================================
CREATE TABLE reading_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  current_position DECIMAL(5,2) DEFAULT 0 CHECK (current_position >= 0 AND current_position <= 100),
  is_finished BOOLEAN DEFAULT FALSE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  finished_at TIMESTAMPTZ,
  last_accessed TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

-- ============================================================================
-- RESONANCE_VECTORS TABLE
-- ============================================================================
CREATE TABLE resonance_vectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  embedding vector(384),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ENGAGEMENT_EVENTS TABLE
-- ============================================================================
CREATE TABLE engagement_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('view', 'purchase', 'read', 'rating', 'share', 'wishlist')),
  event_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MANUSCRIPTS TABLE
-- ============================================================================
CREATE TABLE manuscripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID NOT NULL REFERENCES authors(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  working_title TEXT,
  genre TEXT NOT NULL,
  synopsis TEXT,
  word_count INTEGER,
  target_audience TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'revisions_requested', 'accepted', 'rejected', 'published')),
  current_stage TEXT,
  editorial_notes TEXT,
  manuscript_file_url TEXT,
  sample_chapters_url TEXT,
  cover_draft_url TEXT,
  submission_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PARTNERS TABLE
-- ============================================================================
CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  institution_name TEXT NOT NULL,
  subscription_plan TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ARC_REQUESTS TABLE
-- ============================================================================
CREATE TABLE arc_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'fulfilled', 'rejected')),
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ORDERS TABLE
-- ============================================================================
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  total_amount DECIMAL(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled', 'refunded')),
  payment_intent_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- ORDER_ITEMS TABLE
-- ============================================================================
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  unit_price DECIMAL(10,2) NOT NULL,
  license_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SUBSCRIPTIONS TABLE
-- ============================================================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Books indexes
CREATE INDEX idx_books_published ON books(published_at DESC) WHERE status = 'published';
CREATE INDEX idx_books_featured ON books(featured_at DESC) WHERE is_featured = true;
CREATE INDEX idx_books_genre ON books(genre);
CREATE INDEX idx_books_author ON books(author_id);
CREATE INDEX idx_books_search ON books USING GIN(search_vector);
CREATE INDEX idx_books_slug ON books(slug);
CREATE INDEX idx_books_status ON books(status);
CREATE INDEX idx_books_visibility ON books(visibility);

-- Resonance vectors indexes
CREATE INDEX idx_resonance_vectors_book ON resonance_vectors(book_id);
CREATE INDEX idx_resonance_vectors_embedding ON resonance_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Reading progress indexes
CREATE INDEX idx_reading_progress_user ON reading_progress(user_id);
CREATE INDEX idx_reading_progress_book ON reading_progress(book_id);
CREATE INDEX idx_reading_progress_last_accessed ON reading_progress(last_accessed DESC);
CREATE INDEX idx_reading_progress_finished ON reading_progress(is_finished) WHERE is_finished = true;

-- Manuscripts indexes
CREATE INDEX idx_manuscripts_author ON manuscripts(author_id);
CREATE INDEX idx_manuscripts_status ON manuscripts(status);
CREATE INDEX idx_manuscripts_stage ON manuscripts(current_stage);
CREATE INDEX idx_manuscripts_submission_date ON manuscripts(submission_date DESC);

-- Engagement events indexes
CREATE INDEX idx_engagement_user_book ON engagement_events(user_id, book_id);
CREATE INDEX idx_engagement_type_time ON engagement_events(event_type, created_at DESC);
CREATE INDEX idx_engagement_book ON engagement_events(book_id);

-- Orders indexes
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_created ON orders(created_at DESC);

-- Order items indexes
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_book ON order_items(book_id);

-- Subscriptions indexes
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);

-- Profiles indexes
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);

-- Authors indexes
CREATE INDEX idx_authors_profile ON authors(profile_id);
CREATE INDEX idx_authors_verified ON authors(is_verified) WHERE is_verified = true;

-- Partners indexes
CREATE INDEX idx_partners_profile ON partners(profile_id);

-- ARC requests indexes
CREATE INDEX idx_arc_requests_partner ON arc_requests(partner_id);
CREATE INDEX idx_arc_requests_book ON arc_requests(book_id);
CREATE INDEX idx_arc_requests_status ON arc_requests(status);

-- Notifications indexes
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read) WHERE read = false;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_authors_updated_at BEFORE UPDATE ON authors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_books_updated_at BEFORE UPDATE ON books FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_manuscripts_updated_at BEFORE UPDATE ON manuscripts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_partners_updated_at BEFORE UPDATE ON partners FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_arc_requests_updated_at BEFORE UPDATE ON arc_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reading_progress_updated_at BEFORE UPDATE ON reading_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_resonance_vectors_updated_at BEFORE UPDATE ON resonance_vectors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update book stats
CREATE OR REPLACE FUNCTION update_book_stats() RETURNS TRIGGER AS $$
BEGIN
  UPDATE books SET 
    total_reviews = (SELECT COUNT(*) FROM reading_progress WHERE book_id = NEW.book_id AND rating IS NOT NULL),
    average_rating = (SELECT COALESCE(AVG(rating), 0) FROM reading_progress WHERE book_id = NEW.book_id AND rating IS NOT NULL)
  WHERE id = NEW.book_id;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_book_stats_trigger AFTER INSERT OR UPDATE ON reading_progress FOR EACH ROW EXECUTE FUNCTION update_book_stats();

-- Update author stats
CREATE OR REPLACE FUNCTION update_author_stats() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE authors SET total_books = total_books + 1 WHERE id = NEW.author_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE authors SET total_books = GREATEST(0, total_books - 1) WHERE id = OLD.author_id;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_author_stats_trigger AFTER INSERT OR DELETE ON books FOR EACH ROW EXECUTE FUNCTION update_author_stats();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE manuscripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE arc_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Books policies
CREATE POLICY "Published books are public" ON books FOR SELECT USING (status = 'published' AND visibility = 'public');
CREATE POLICY "Authors can view their own books" ON books FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM authors 
    WHERE authors.id = books.author_id 
    AND authors.profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "Authors can update their own books" ON books FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM authors 
    WHERE authors.id = books.author_id 
    AND authors.profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- Reading progress policies
CREATE POLICY "Users can view own reading progress" ON reading_progress FOR SELECT USING (
  user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Users can manage own reading progress" ON reading_progress FOR ALL USING (
  user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Manuscripts policies
CREATE POLICY "Authors can view own manuscripts" ON manuscripts FOR SELECT USING (
  author_id IN (
    SELECT id FROM authors 
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "Authors can manage own manuscripts" ON manuscripts FOR ALL USING (
  author_id IN (
    SELECT id FROM authors 
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- Partners policies
CREATE POLICY "Partners can view own data" ON partners FOR SELECT USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- ARC requests policies
CREATE POLICY "Partners can view own requests" ON arc_requests FOR SELECT USING (
  partner_id IN (
    SELECT id FROM partners 
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);
CREATE POLICY "Partners can create own requests" ON arc_requests FOR INSERT WITH CHECK (
  partner_id IN (
    SELECT id FROM partners 
    WHERE profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
);

-- Orders policies
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (
  user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Subscriptions policies
CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (
  user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Notifications policies
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT USING (
  user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE USING (
  user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- ============================================================================
-- VIEWS
-- ============================================================================

CREATE VIEW book_overview AS 
SELECT 
  b.id, b.title, b.slug, b.cover_url, b.genre, b.price, 
  b.average_rating, b.total_reads, b.total_reviews, b.published_at,
  a.pen_name as author_name, a.photo_url as author_photo,
  a.id as author_id
FROM books b 
JOIN authors a ON b.author_id = a.id 
WHERE b.status = 'published' AND b.visibility = 'public';

CREATE VIEW author_earnings AS 
SELECT 
  a.id as author_id, a.pen_name,
  COUNT(DISTINCT b.id) as total_books,
  COALESCE(SUM(oi.unit_price * (a.royalty_rate / 100)), 0) as total_earnings,
  COALESCE(SUM(oi.unit_price), 0) as total_sales 
FROM authors a 
LEFT JOIN books b ON a.id = b.author_id 
LEFT JOIN order_items oi ON b.id = oi.book_id 
LEFT JOIN orders o ON oi.order_id = o.id AND o.status = 'completed'
GROUP BY a.id, a.pen_name;

-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_similar_books(
  target_book_id UUID,
  match_count INT DEFAULT 6
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.title,
    b.slug,
    1 - (rv1.embedding <=> rv2.embedding) as similarity
  FROM books b
  JOIN resonance_vectors rv1 ON rv1.book_id = target_book_id
  JOIN resonance_vectors rv2 ON rv2.book_id = b.id
  WHERE b.id != target_book_id 
    AND b.status = 'published'
    AND b.visibility = 'public'
  ORDER BY rv1.embedding <=> rv2.embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION get_recommendations(
  target_user_id UUID,
  recommendation_limit INT DEFAULT 12
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  slug TEXT,
  score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH user_preferences AS (
    SELECT 
      b.genre,
      COUNT(*) as read_count,
      AVG(rp.rating) as avg_rating
    FROM reading_progress rp
    JOIN books b ON rp.book_id = b.id
    WHERE rp.user_id = target_user_id
      AND rp.rating IS NOT NULL
    GROUP BY b.genre
  )
  SELECT 
    b.id,
    b.title,
    b.slug,
    (
      COALESCE((SELECT avg_rating FROM user_preferences WHERE genre = b.genre), 0) * 0.4 +
      COALESCE(b.average_rating, 0) * 0.3 +
      (b.total_reads::FLOAT / NULLIF((SELECT MAX(total_reads) FROM books WHERE status = 'published'), 0)) * 0.3
    ) as score
  FROM books b
  WHERE b.status = 'published'
    AND b.visibility = 'public'
    AND b.id NOT IN (SELECT book_id FROM reading_progress WHERE user_id = target_user_id)
  ORDER BY score DESC
  LIMIT recommendation_limit;
END;
$$;

CREATE OR REPLACE FUNCTION update_reading_progress(
  target_user_id UUID,
  target_book_id UUID,
  new_position DECIMAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO reading_progress (user_id, book_id, current_position, last_accessed)
  VALUES (target_user_id, target_book_id, new_position, NOW())
  ON CONFLICT (user_id, book_id) 
  DO UPDATE SET 
    current_position = new_position,
    last_accessed = NOW(),
    updated_at = NOW();
END;
$$;
