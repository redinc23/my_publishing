-- Backfill profile/author foreign keys to use user IDs

-- Drop existing foreign keys before backfill
ALTER TABLE authors DROP CONSTRAINT IF EXISTS authors_profile_id_fkey;
ALTER TABLE partners DROP CONSTRAINT IF EXISTS partners_profile_id_fkey;
ALTER TABLE reading_sessions DROP CONSTRAINT IF EXISTS reading_sessions_user_id_fkey;
ALTER TABLE reading_progress DROP CONSTRAINT IF EXISTS reading_progress_user_id_fkey;
ALTER TABLE engagement_events DROP CONSTRAINT IF EXISTS engagement_events_user_id_fkey;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE books DROP CONSTRAINT IF EXISTS books_author_id_fkey;

-- Backfill profiles.id -> profiles.user_id
UPDATE authors a
SET profile_id = p.user_id
FROM profiles p
WHERE a.profile_id = p.id;

UPDATE partners pr
SET profile_id = p.user_id
FROM profiles p
WHERE pr.profile_id = p.id;

UPDATE reading_sessions rs
SET user_id = p.user_id
FROM profiles p
WHERE rs.user_id = p.id;

UPDATE reading_progress rp
SET user_id = p.user_id
FROM profiles p
WHERE rp.user_id = p.id;

UPDATE engagement_events ee
SET user_id = p.user_id
FROM profiles p
WHERE ee.user_id = p.id;

UPDATE orders o
SET user_id = p.user_id
FROM profiles p
WHERE o.user_id = p.id;

UPDATE subscriptions s
SET user_id = p.user_id
FROM profiles p
WHERE s.user_id = p.id;

UPDATE notifications n
SET user_id = p.user_id
FROM profiles p
WHERE n.user_id = p.id;

-- Backfill authors.id -> authors.profile_id
UPDATE books b
SET author_id = a.profile_id
FROM authors a
WHERE b.author_id = a.id;

-- Ensure FK targets are unique
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_id_unique_idx ON profiles(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS authors_profile_id_unique_idx ON authors(profile_id);

-- Recreate foreign keys pointing at user-id columns
ALTER TABLE authors
  ADD CONSTRAINT authors_profile_id_fkey
  FOREIGN KEY (profile_id)
  REFERENCES profiles(user_id)
  ON DELETE CASCADE;

ALTER TABLE partners
  ADD CONSTRAINT partners_profile_id_fkey
  FOREIGN KEY (profile_id)
  REFERENCES profiles(user_id)
  ON DELETE CASCADE;

ALTER TABLE reading_sessions
  ADD CONSTRAINT reading_sessions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES profiles(user_id)
  ON DELETE CASCADE;

ALTER TABLE reading_progress
  ADD CONSTRAINT reading_progress_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES profiles(user_id)
  ON DELETE CASCADE;

ALTER TABLE engagement_events
  ADD CONSTRAINT engagement_events_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES profiles(user_id)
  ON DELETE SET NULL;

ALTER TABLE orders
  ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES profiles(user_id)
  ON DELETE CASCADE;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES profiles(user_id)
  ON DELETE CASCADE;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id)
  REFERENCES profiles(user_id)
  ON DELETE CASCADE;

ALTER TABLE books
  ADD CONSTRAINT books_author_id_fkey
  FOREIGN KEY (author_id)
  REFERENCES authors(profile_id)
  ON DELETE SET NULL;

-- Update RLS policies to compare auth.uid() to user-id columns
DROP POLICY IF EXISTS "Authors can view their own books" ON books;
CREATE POLICY "Authors can view their own books" ON books FOR SELECT
USING (author_id = auth.uid());

DROP POLICY IF EXISTS "Authors can update their own books" ON books;
CREATE POLICY "Authors can update their own books" ON books FOR UPDATE
USING (author_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own reading progress" ON reading_progress;
CREATE POLICY "Users can view own reading progress" ON reading_progress FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can manage own reading progress" ON reading_progress;
CREATE POLICY "Users can manage own reading progress" ON reading_progress FOR ALL
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Authors can view own manuscripts" ON manuscripts;
CREATE POLICY "Authors can view own manuscripts" ON manuscripts FOR SELECT
USING (
  author_id IN (
    SELECT id FROM authors
    WHERE profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authors can manage own manuscripts" ON manuscripts;
CREATE POLICY "Authors can manage own manuscripts" ON manuscripts FOR ALL
USING (
  author_id IN (
    SELECT id FROM authors
    WHERE profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Partners can view own data" ON partners;
CREATE POLICY "Partners can view own data" ON partners FOR SELECT
USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "Partners can view own requests" ON arc_requests;
CREATE POLICY "Partners can view own requests" ON arc_requests FOR SELECT
USING (
  partner_id IN (
    SELECT id FROM partners
    WHERE profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Partners can create own requests" ON arc_requests;
CREATE POLICY "Partners can create own requests" ON arc_requests FOR INSERT
WITH CHECK (
  partner_id IN (
    SELECT id FROM partners
    WHERE profile_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can view own orders" ON orders;
CREATE POLICY "Users can view own orders" ON orders FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own subscriptions" ON subscriptions;
CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
CREATE POLICY "Users can view own notifications" ON notifications FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications FOR UPDATE
USING (user_id = auth.uid());

-- Update author stats function to match new author_id values
CREATE OR REPLACE FUNCTION update_author_stats() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE authors SET total_books = total_books + 1 WHERE profile_id = NEW.author_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE authors SET total_books = GREATEST(0, total_books - 1) WHERE profile_id = OLD.author_id;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Update book overview view to join on authors.profile_id
CREATE OR REPLACE VIEW book_overview AS 
SELECT 
  b.id, b.title, b.slug, b.cover_url, b.genre, b.price, 
  b.average_rating, b.total_reads, b.total_reviews, b.published_at,
  a.pen_name as author_name, a.photo_url as author_photo,
  a.profile_id as author_id
FROM books b 
JOIN authors a ON b.author_id = a.profile_id 
WHERE b.status = 'published' AND b.visibility = 'public';

-- Keep author earnings view consistent with updated author_id
CREATE OR REPLACE VIEW author_earnings AS 
SELECT 
  a.profile_id as author_id, a.pen_name,
  COUNT(DISTINCT b.id) as total_books,
  COALESCE(SUM(oi.unit_price * (a.royalty_rate / 100)), 0) as total_earnings,
  COALESCE(SUM(oi.unit_price), 0) as total_sales 
FROM authors a 
LEFT JOIN books b ON a.profile_id = b.author_id 
LEFT JOIN order_items oi ON b.id = oi.book_id 
LEFT JOIN orders o ON oi.order_id = o.id AND o.status = 'completed'
GROUP BY a.profile_id, a.pen_name;
