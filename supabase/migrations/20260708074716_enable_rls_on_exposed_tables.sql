-- Backfilled from hosted project history (supabase_migrations.schema_migrations,
-- version 20260708074716). Already applied on hosted; kept locally so migration
-- history matches.

ALTER TABLE public.book_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resonance_vectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events_2025 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events_2026 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events_2027 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events_default ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
