-- Backfilled from hosted project history (supabase_migrations.schema_migrations,
-- version 20260708074819). Already applied on hosted; kept locally so migration
-- history matches.

-- author_earnings: financial data, must never be readable by anon or arbitrary signed-in users
REVOKE SELECT ON public.author_earnings FROM anon, authenticated;

-- handle_new_user: trigger function, should never be a public RPC (trigger still fires as owner)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;

-- update_reading_progress: anon must not write anyone's progress; authenticated kept (app may call it) — verify in smoke test
REVOKE EXECUTE ON FUNCTION public.update_reading_progress(uuid, uuid, numeric) FROM anon;
