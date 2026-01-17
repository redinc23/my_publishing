-- Author payouts system
CREATE TABLE IF NOT EXISTS author_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_connected_account_id TEXT NOT NULL,
  
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  
  total_earnings INTEGER NOT NULL,
  platform_fee INTEGER NOT NULL,
  net_amount INTEGER NOT NULL,
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  stripe_payout_id TEXT,
  
  paid_at TIMESTAMPTZ,
  failure_reason TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID NOT NULL REFERENCES author_payouts(id) ON DELETE CASCADE,
  sale_id UUID NOT NULL REFERENCES book_sales(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  
  amount INTEGER NOT NULL,
  fee INTEGER NOT NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payouts_author ON author_payouts(author_id, created_at DESC);
CREATE INDEX idx_payouts_status ON author_payouts(status, created_at DESC);
CREATE INDEX idx_payout_items_payout ON payout_items(payout_id);

ALTER TABLE author_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors can view their payouts"
  ON author_payouts
  FOR SELECT
  USING (author_id = auth.uid());

CREATE POLICY "Authors can view their payout items"
  ON payout_items
  FOR SELECT
  USING (
    payout_id IN (
      SELECT id FROM author_payouts WHERE author_id = auth.uid()
    )
  );