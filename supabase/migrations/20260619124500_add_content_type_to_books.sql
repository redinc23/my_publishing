-- Add content_type to support books, comics, papers
-- Task 1.3 for Library dropdown navigation

ALTER TABLE books 
ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'book'
CHECK (content_type IN ('book', 'comic', 'paper'));

CREATE INDEX IF NOT EXISTS idx_books_content_type ON books(content_type);

-- Backfill existing books if any (safe)
UPDATE books SET content_type = 'book' WHERE content_type IS NULL;

COMMENT ON COLUMN books.content_type IS 'book | comic | paper for navigation filtering';