-- Resolve high-confidence Supabase security-advisor findings without widening
-- the public API surface.

-- Both views must enforce the querying role's grants and RLS.
ALTER VIEW public.book_overview SET (security_invoker = true);
REVOKE ALL ON public.book_overview FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.book_overview TO anon, authenticated, service_role;

ALTER VIEW public.public_profiles SET (security_invoker = true);
REVOKE ALL ON public.public_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_profiles TO service_role;

-- Pin every remaining mutable function search_path reported by the advisor.
ALTER FUNCTION public.update_updated_at_column()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_book_stats()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_author_stats()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.refresh_book_stats_daily(date, uuid)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.check_file_safety()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.check_rate_limit(text, integer, interval)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_book_stats_daily()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.update_book_review_stats()
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_book_average_rating(uuid)
  SET search_path = pg_catalog, public;
ALTER FUNCTION public.get_book_review_count(uuid)
  SET search_path = pg_catalog, public;

-- All current engagement writes go through the server-only service-role client.
DROP POLICY IF EXISTS "Anyone can insert engagement events" ON public.engagement_events;
REVOKE INSERT ON public.engagement_events FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.engagement_events TO service_role;

-- Public object URLs do not require a broad storage.objects listing policy.
DROP POLICY IF EXISTS "Book covers are publicly readable" ON storage.objects;
