-- Tighten analytics_sessions RLS:
-- 1) Replace unrestricted FOR ALL USING (true) with service_role management
-- 2) Fix author SELECT to compare books.author_id against authors.id (via profile)
-- 3) Ensure session upsert trigger can still write under SECURITY DEFINER
-- 4) Expose a safe public_profiles view for live-reader display (no email/preferences)

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false)
AS
SELECT
  user_id,
  full_name AS name
FROM public.profiles;

COMMENT ON VIEW public.public_profiles IS
  'Safe reader display fields for analytics. Excludes email and preferences.';

GRANT SELECT ON public.public_profiles TO anon, authenticated, service_role;

-- Session upsert from analytics_events inserts must bypass restrictive RLS
CREATE OR REPLACE FUNCTION update_analytics_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO analytics_sessions (
    session_id,
    book_id,
    user_id,
    device_id,
    last_activity_at,
    total_events,
    device_type,
    browser,
    os,
    country_code,
    region,
    city,
    referrer
  ) VALUES (
    NEW.session_id,
    NEW.book_id,
    NEW.user_id,
    NEW.device_id,
    NEW.created_at,
    1,
    NEW.device_type,
    NEW.browser,
    NEW.os,
    NEW.country_code,
    NEW.region,
    NEW.city,
    NEW.referrer
  )
  ON CONFLICT (session_id) DO UPDATE SET
    last_activity_at = NEW.created_at,
    total_events = analytics_sessions.total_events + 1,
    is_active = (NEW.created_at - analytics_sessions.last_activity_at) < INTERVAL '30 minutes',
    updated_at = NOW();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mark_inactive_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE analytics_sessions
  SET
    is_active = false,
    ended_at = last_activity_at
  WHERE
    is_active = true
    AND last_activity_at < NOW() - INTERVAL '30 minutes';
END;
$$;

DROP POLICY IF EXISTS "System can manage sessions" ON analytics_sessions;
DROP POLICY IF EXISTS "Service role can manage sessions" ON analytics_sessions;
CREATE POLICY "Service role can manage sessions"
  ON analytics_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Authors can view sessions for their books" ON analytics_sessions;
CREATE POLICY "Authors can view sessions for their books"
  ON analytics_sessions
  FOR SELECT
  TO authenticated
  USING (
    book_id IN (
      SELECT b.id
      FROM books b
      INNER JOIN authors a ON a.id = b.author_id
      INNER JOIN profiles p ON p.id = a.profile_id
      WHERE p.user_id = auth.uid()
    )
  );
