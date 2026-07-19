-- 20260719021959_email_preferences.sql
-- Transactional email system (feat/topdog-comms): per-user email preferences.
-- Idempotent: safe to run more than once.

CREATE TABLE IF NOT EXISTS public.email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Auth user id (auth.users.id), matching how the app resolves identity.
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Marketing email (newsletters, promos). OFF by default: explicit opt-in only.
  marketing BOOLEAN NOT NULL DEFAULT FALSE,
  -- Transactional receipts (purchase confirmations). ON by default.
  receipts BOOLEAN NOT NULL DEFAULT TRUE,
  -- Author alerts (new reviews of your books, payout notices). ON by default.
  author_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT email_preferences_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_email_preferences_user ON public.email_preferences(user_id);

-- updated_at maintenance (function created in 20260116000000_initial_schema.sql)
DROP TRIGGER IF EXISTS update_email_preferences_updated_at ON public.email_preferences;
CREATE TRIGGER update_email_preferences_updated_at
  BEFORE UPDATE ON public.email_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

-- Users manage only their own preferences. No DELETE policy: rows are kept
-- (service_role retains full access for support/cleanup).
DROP POLICY IF EXISTS "Users can view own email preferences" ON public.email_preferences;
CREATE POLICY "Users can view own email preferences" ON public.email_preferences
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert own email preferences" ON public.email_preferences;
CREATE POLICY "Users can insert own email preferences" ON public.email_preferences
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update own email preferences" ON public.email_preferences;
CREATE POLICY "Users can update own email preferences" ON public.email_preferences
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
