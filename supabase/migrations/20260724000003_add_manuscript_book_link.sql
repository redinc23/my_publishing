-- ============================================================================
-- LINK MANUSCRIPTS TO BOOKS (PR 1, migration 4/7)
-- ============================================================================
-- Schema-only preparation for accepted-manuscript -> draft-book conversion.
-- One manuscript can produce at most one book; deleting a book never deletes
-- the source manuscript (it is a separate historical/editorial asset).
-- ============================================================================

ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS book_id UUID;
ALTER TABLE manuscripts ADD COLUMN IF NOT EXISTS converted_by_profile_id UUID;
-- converted_at was added in 20260724000000_expand_manuscript_workflow.sql.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manuscripts_book_id_fkey') THEN
    ALTER TABLE manuscripts
      ADD CONSTRAINT manuscripts_book_id_fkey
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manuscripts_converted_by_profile_id_fkey') THEN
    ALTER TABLE manuscripts
      ADD CONSTRAINT manuscripts_converted_by_profile_id_fkey
      FOREIGN KEY (converted_by_profile_id) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- One manuscript -> at most one book (partial unique index).
CREATE UNIQUE INDEX IF NOT EXISTS manuscripts_book_id_unique
  ON manuscripts (book_id)
  WHERE book_id IS NOT NULL;

-- Conversion fields are all-or-nothing, and only valid in converted state.
-- Legacy rows migrated to 'converted_to_book' in 20260724000000 have no
-- linkage metadata, so allow converted_to_book with NULL fields (historical),
-- but never linkage metadata outside converted_to_book.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'manuscripts_conversion_consistency') THEN
    ALTER TABLE manuscripts
      ADD CONSTRAINT manuscripts_conversion_consistency
      CHECK (
        (
          book_id IS NULL
          AND converted_at IS NULL
          AND converted_by_profile_id IS NULL
        )
        OR
        (
          book_id IS NOT NULL
          AND converted_at IS NOT NULL
          AND converted_by_profile_id IS NOT NULL
          AND status = 'converted_to_book'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN manuscripts.book_id IS
  'Draft book created from this accepted manuscript. ON DELETE SET NULL: removing a book never erases the manuscript.';
