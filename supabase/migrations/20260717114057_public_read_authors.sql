-- Fix: authors table has RLS enabled but no SELECT policy, so even anonymous
-- catalog pages could not resolve author names ("Unknown Author" everywhere).
-- Author identity (pen name, bio, photo) is public catalog data.
--
-- NOTE: profiles intentionally stays self-view only — it contains emails and
-- preferences. Public surfaces read author/profile data through the service
-- role with the safe column list in lib/supabase/public-queries.ts.

DROP POLICY IF EXISTS "Authors are publicly viewable" ON authors;
CREATE POLICY "Authors are publicly viewable"
ON authors FOR SELECT
USING (true);
