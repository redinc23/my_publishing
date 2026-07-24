-- Book pricing tables
CREATE TABLE IF NOT EXISTS book_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE UNIQUE,
  
  base_price INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  
  regional_prices JSONB DEFAULT '[]'::jsonb,
  
  discount_percentage NUMERIC(5,2),
  discount_until TIMESTAMPTZ,
  
  is_free BOOLEAN DEFAULT false,
  allow_pay_what_you_want BOOLEAN DEFAULT false,
  minimum_price INTEGER,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_book_pricing_book ON book_pricing(book_id);

ALTER TABLE book_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can manage pricing for their books"
  ON book_pricing
  FOR ALL
  USING (
    book_id IN (
      SELECT id FROM books WHERE author_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can view pricing"
  ON book_pricing
  FOR SELECT
  USING (true);