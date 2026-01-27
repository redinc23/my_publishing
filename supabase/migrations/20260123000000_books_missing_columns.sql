-- Add missing columns to books table
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS author_name TEXT DEFAULT 'Unknown Author',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS categories TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subtitle TEXT,
  ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS seo_title TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;

-- Backfill author_name for existing rows that might be NULL
UPDATE books SET author_name = 'Unknown Author' WHERE author_name IS NULL;

-- Add missing indexes to books table
-- Use partial index for deleted_at to optimize IS NULL queries (soft-delete pattern)
-- This creates a smaller, more efficient index that only includes non-deleted rows
CREATE INDEX IF NOT EXISTS idx_books_deleted_at ON books(id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_books_language ON books(language);
