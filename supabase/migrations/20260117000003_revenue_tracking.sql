-- Revenue tracking tables
CREATE TABLE IF NOT EXISTS book_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT,
  
  base_price INTEGER NOT NULL,
  discount_amount INTEGER DEFAULT 0,
  tax_amount INTEGER DEFAULT 0,
  
  platform_fee INTEGER NOT NULL,
  author_earnings INTEGER NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  refund_reason TEXT,
  
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_book_sales_book ON book_sales(book_id, purchased_at DESC);
CREATE INDEX idx_book_sales_user ON book_sales(user_id, purchased_at DESC);
CREATE INDEX idx_book_sales_status ON book_sales(status, purchased_at DESC);

ALTER TABLE book_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can view sales for their books"
  ON book_sales
  FOR SELECT
  USING (
    book_id IN (
      SELECT id FROM books WHERE author_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own purchases"
  ON book_sales
  FOR SELECT
  USING (user_id = auth.uid());