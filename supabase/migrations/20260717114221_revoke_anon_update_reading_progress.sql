-- Lock down EXECUTE on the SECURITY DEFINER RPC update_reading_progress.
--
-- 20260708074819 revoked the direct anon grant, but functions get an implicit
-- EXECUTE grant to PUBLIC at creation (visible as "=X/postgres" in proacl), and
-- anon inherits PUBLIC. So anon could still call the RPC and write arbitrary
-- users' reading progress (it takes target_user_id and bypasses RLS).
--
-- Revoke PUBLIC and anon, then grant explicitly to authenticated (the app
-- calls it for signed-in readers) and service_role.

REVOKE EXECUTE ON FUNCTION public.update_reading_progress(uuid, uuid, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_reading_progress(uuid, uuid, numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_reading_progress(uuid, uuid, numeric) TO authenticated, service_role;
