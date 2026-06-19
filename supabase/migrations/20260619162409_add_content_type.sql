-- Task 1.3: Add content_type field to support Books, Comics, Papers
ALTER TABLE books 
ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'book'
  CHECK (content_type IN ('book', 'comic', 'paper'));

CREATE INDEX IF NOT EXISTS idx_books_content_type ON books(content_type);

COMMENT ON COLUMN books.content_type IS 'book | comic | paper for Library dropdown sections';

-- Safe for empty table
UPDATE books SET content_type = 'book' WHERE content_type IS NULL;