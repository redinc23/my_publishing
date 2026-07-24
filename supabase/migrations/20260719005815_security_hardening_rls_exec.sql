-- 20260719005815_security_hardening_rls_exec.sql
-- Kimi swarm security hardening (directive Phase 4/11, live audit 2026-07-19).
-- Applied to production via Supabase MCP on 2026-07-19; verification notes in PR #251.

-- P0: stop per-book revenue exposure via definer view book_stats_summary.
-- View is not referenced by any enabled client path (MCP transport is disabled
-- by default); service_role retains full access for server-side reporting.
REVOKE SELECT ON public.book_stats_summary FROM anon;
REVOKE SELECT ON public.book_stats_summary FROM authenticated;

-- P0: repair dead `books.author_id = auth.uid()` policies. books.author_id
-- references authors.id, NOT auth.users.id, so these policies never matched.
-- Correct ownership join: books.author_id -> authors.id -> authors.profile_id
-- -> profiles.user_id. (SELECT auth.uid()) form also fixes initplan warnings.
DROP POLICY IF EXISTS "Authors can delete own books" ON public.books;
DROP POLICY IF EXISTS "Authors can insert books" ON public.books;
DROP POLICY IF EXISTS "Authors can update own books" ON public.books;
DROP POLICY IF EXISTS "Authors can view own books" ON public.books;
DROP POLICY IF EXISTS "Authors can insert own books" ON public.books;
DROP POLICY IF EXISTS "Authors can delete own books" ON public.books;
-- SELECT/UPDATE already have correct EXISTS-join policies on books
-- ("Authors can view their own books", "Authors can update their own books");
-- an UPDATE policy without WITH CHECK reuses USING for new-row validation.
CREATE POLICY "Authors can insert own books" ON public.books FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.authors
    WHERE authors.id = books.author_id
      AND authors.profile_id IN (SELECT id FROM public.profiles WHERE profiles.user_id = (SELECT auth.uid()))
  ));
CREATE POLICY "Authors can delete own books" ON public.books FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.authors
    WHERE authors.id = books.author_id
      AND authors.profile_id IN (SELECT id FROM public.profiles WHERE profiles.user_id = (SELECT auth.uid()))
  ));
-- dedupe identical public-published SELECT policies on books
DROP POLICY IF EXISTS "Published books are public" ON public.books;

DROP POLICY IF EXISTS "Authors can view analytics for their books" ON public.analytics_events;
CREATE POLICY "Authors can view analytics for their books" ON public.analytics_events FOR SELECT TO authenticated
  USING (book_id IN (
    SELECT b.id FROM public.books b
    WHERE EXISTS (
      SELECT 1 FROM public.authors a
      WHERE a.id = b.author_id
        AND a.profile_id IN (SELECT id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid()))
    )
  ));

DROP POLICY IF EXISTS "Authors can view stats for their books" ON public.book_stats_daily;
CREATE POLICY "Authors can view stats for their books" ON public.book_stats_daily FOR SELECT TO authenticated
  USING (book_id IN (
    SELECT b.id FROM public.books b
    WHERE EXISTS (
      SELECT 1 FROM public.authors a
      WHERE a.id = b.author_id
        AND a.profile_id IN (SELECT id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid()))
    )
  ));

DROP POLICY IF EXISTS "Authors can view sales for their books" ON public.book_sales;
CREATE POLICY "Authors can view sales for their books" ON public.book_sales FOR SELECT TO authenticated
  USING (book_id IN (
    SELECT b.id FROM public.books b
    WHERE EXISTS (
      SELECT 1 FROM public.authors a
      WHERE a.id = b.author_id
        AND a.profile_id IN (SELECT id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid()))
    )
  ));

DROP POLICY IF EXISTS "Authors can manage pricing for their books" ON public.book_pricing;
CREATE POLICY "Authors can manage pricing for their books" ON public.book_pricing FOR ALL TO authenticated
  USING (book_id IN (
    SELECT b.id FROM public.books b
    WHERE EXISTS (
      SELECT 1 FROM public.authors a
      WHERE a.id = b.author_id
        AND a.profile_id IN (SELECT id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid()))
    )
  ))
  WITH CHECK (book_id IN (
    SELECT b.id FROM public.books b
    WHERE EXISTS (
      SELECT 1 FROM public.authors a
      WHERE a.id = b.author_id
        AND a.profile_id IN (SELECT id FROM public.profiles p WHERE p.user_id = (SELECT auth.uid()))
    )
  ));

-- P1: stop anonymous enumeration of authors.royalty_rate via PostgREST.
-- Column-level grants keep every confirmed app read path working
-- (PUBLIC_AUTHOR_COLUMNS excludes royalty_rate; admin paths use service_role).
REVOKE SELECT ON public.authors FROM anon;
REVOKE SELECT ON public.authors FROM authenticated;
GRANT SELECT (id, profile_id, pen_name, bio, is_verified, total_books, photo_url, created_at, updated_at) ON public.authors TO anon;
GRANT SELECT (id, profile_id, pen_name, bio, is_verified, total_books, photo_url, created_at, updated_at) ON public.authors TO authenticated;

-- P0/P1: SECURITY DEFINER function hardening.
ALTER FUNCTION public.get_similar_books(uuid, integer) SET search_path = public;
ALTER FUNCTION public.update_reading_progress(uuid, uuid, numeric) SET search_path = public;

-- get_recommendations: add caller authorization (was: anon could enumerate ANY
-- user's reading-based recommendations) + pin search_path. Body unchanged.
CREATE OR REPLACE FUNCTION public.get_recommendations(target_user_id uuid, recommendation_limit integer DEFAULT 12)
 RETURNS TABLE(id uuid, title text, slug text, score double precision)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  -- Callers may only request their own recommendations; service_role is exempt
  -- (server-side rendering and admin tooling).
  IF target_user_id IS DISTINCT FROM auth.uid()
     AND COALESCE(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden: cannot read other users'' recommendations' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH user_preferences AS (
    SELECT
      b.genre,
      COUNT(*) as read_count,
      AVG(rp.rating) as avg_rating
    FROM reading_progress rp
    JOIN books b ON rp.book_id = b.id
    WHERE rp.user_id = target_user_id
      AND rp.rating IS NOT NULL
    GROUP BY b.genre
  )
  SELECT
    b.id,
    b.title,
    b.slug,
    (
      COALESCE((SELECT avg_rating FROM user_preferences WHERE genre = b.genre), 0) * 0.4 +
      COALESCE(b.average_rating, 0) * 0.3 +
      (b.total_reads::FLOAT / NULLIF((SELECT MAX(total_reads) FROM books WHERE status = 'published'), 0)) * 0.3
    ) as score
  FROM books b
  WHERE b.status = 'published'
    AND b.visibility = 'public'
    AND b.id NOT IN (SELECT book_id FROM reading_progress WHERE user_id = target_user_id)
  ORDER BY score DESC
  LIMIT recommendation_limit;
END;
$function$;

-- Tighten EXECUTE surface. PUBLIC EXECUTE is the Supabase default; revoking it
-- from anon/PUBLIC alone does nothing unless the role grant is also removed.
REVOKE EXECUTE ON FUNCTION public.get_recommendations(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_recommendations(uuid, integer) TO authenticated, service_role;
-- Trigger-only / maintenance functions (no app RPC callers):
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profiles_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_analytics_session() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_inactive_sessions() FROM PUBLIC, anon, authenticated;

-- Feature repair: engagement_events had RLS enabled with zero policies, so
-- trackEngagement() inserts via the session client silently failed for all
-- users. Mirror the analytics_events insert policy (public insert, no read).
DROP POLICY IF EXISTS "Anyone can insert engagement events" ON public.engagement_events;
CREATE POLICY "Anyone can insert engagement events" ON public.engagement_events FOR INSERT TO public WITH CHECK (true);
