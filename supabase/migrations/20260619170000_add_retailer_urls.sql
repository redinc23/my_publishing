-- Task 1.4: external retailer URL fields on books (nullable)
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS amazon_url TEXT,
  ADD COLUMN IF NOT EXISTS kindle_url TEXT,
  ADD COLUMN IF NOT EXISTS apple_books_url TEXT,
  ADD COLUMN IF NOT EXISTS audible_url TEXT,
  ADD COLUMN IF NOT EXISTS barnes_noble_url TEXT,
  ADD COLUMN IF NOT EXISTS google_play_books_url TEXT;

COMMENT ON COLUMN books.amazon_url IS 'External Amazon product URL';
COMMENT ON COLUMN books.kindle_url IS 'External Kindle e-book URL';
COMMENT ON COLUMN books.apple_books_url IS 'External Apple Books URL';
COMMENT ON COLUMN books.audible_url IS 'External Audible audiobook URL';
COMMENT ON COLUMN books.barnes_noble_url IS 'External Barnes & Noble URL';
COMMENT ON COLUMN books.google_play_books_url IS 'External Google Play Books URL';
