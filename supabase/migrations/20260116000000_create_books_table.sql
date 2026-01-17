-- Enhanced books table with additional constraints and optimizations
CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  subtitle TEXT,
  description TEXT,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  
  -- Enhanced metadata with constraints
  isbn TEXT UNIQUE,
  language TEXT DEFAULT 'en' CHECK (language ~ '^[a-z]{2,3}$'),
  page_count INTEGER CHECK (page_count > 0),
  word_count INTEGER CHECK (word_count > 0),
  
  -- Publishing info with enum type
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  
  -- File URLs with validation
  cover_url TEXT CHECK (cover_url IS NULL OR cover_url ~ '^https?://'),
  epub_url TEXT CHECK (epub_url IS NULL OR epub_url ~ '^https?://'),
  manuscript_url TEXT CHECK (manuscript_url IS NULL OR manuscript_url ~ '^https?://'),
  
  -- Stats with better constraints
  view_count INTEGER DEFAULT 0 CHECK (view_count >= 0),
  download_count INTEGER DEFAULT 0 CHECK (download_count >= 0),
  average_rating DECIMAL(3,2) DEFAULT 0 CHECK (average_rating >= 0 AND average_rating <= 5),
  review_count INTEGER DEFAULT 0 CHECK (review_count >= 0),
  
  -- Search optimization
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(subtitle, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(author_name, '')), 'B')
  ) STORED,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ -- Soft delete support
);

-- Enhanced indexes
CREATE INDEX idx_books_author_id ON books(author_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_books_status ON books(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_books_published_at ON books(published_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_books_created_at ON books(created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_books_deleted_at ON books(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_books_search ON books USING GIN(search_vector) WHERE deleted_at IS NULL;

-- Full-text search function
CREATE OR REPLACE FUNCTION books_search(search_query TEXT)
RETURNS TABLE (
  id UUID,
  title TEXT,
  subtitle TEXT,
  author_name TEXT,
  relevance REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.title,
    b.subtitle,
    b.author_name,
    ts_rank(b.search_vector, websearch_to_tsquery('english', search_query)) as relevance
  FROM books b
  WHERE b.search_vector @@ websearch_to_tsquery('english', search_query)
    AND b.status = 'published'
    AND b.deleted_at IS NULL
  ORDER BY relevance DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced RLS Policies with soft delete consideration
CREATE POLICY "Published books are viewable by everyone"
  ON books FOR SELECT
  USING ((status = 'published' OR author_id = auth.uid()) AND deleted_at IS NULL);

-- Add policy for admin to view all books (including deleted)
CREATE POLICY "Admins can view all books"
  ON books FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

-- Soft delete policy instead of hard delete
CREATE POLICY "Authors can soft delete their own books"
  ON books FOR UPDATE
  USING (author_id = auth.uid());

-- Function for soft delete
CREATE OR REPLACE FUNCTION soft_delete_book()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
    NEW.status = 'archived';
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER soft_delete_book_trigger
  BEFORE UPDATE ON books
  FOR EACH ROW
  EXECUTE FUNCTION soft_delete_book();
