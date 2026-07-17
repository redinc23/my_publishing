-- ============================================================================
-- PROTECT profiles.role FROM CLIENT PRIVILEGE ESCALATION
-- ============================================================================
-- Clients previously could UPDATE/INSERT profiles.role via broad table grants
-- and the open "Users can update own profile" RLS policy.
--
-- Intended privileged path for role changes:
--   Admin UI → updateUserRoleAction (app/admin/actions.ts) → createAdminClient()
--   (service_role bypasses RLS and is allowed by the trigger below).
-- Signup must always create role = 'reader'; never trust auth metadata.
-- ============================================================================

-- 1) Signup trigger: ignore raw_user_meta_data.role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NULL),
    'reader'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates a reader profile on signup. Role is always reader; admin changes use service-role admin actions.';

-- 2) Preserve role on client writes unless service_role or an existing admin
CREATE OR REPLACE FUNCTION public.protect_profiles_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean := false;
BEGIN
  -- service_role (and other non-authenticated JWT roles used by admin clients)
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
  ) INTO caller_is_admin;

  IF TG_OP = 'INSERT' THEN
    IF NOT caller_is_admin THEN
      NEW.role := 'reader';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: keep prior role unless caller is admin
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT caller_is_admin THEN
    NEW.role := OLD.role;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profiles_role ON public.profiles;
CREATE TRIGGER protect_profiles_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profiles_role();

COMMENT ON FUNCTION public.protect_profiles_role() IS
  'Blocks client self-escalation of profiles.role. Privileged changes: service_role admin actions (updateUserRoleAction) or an authenticated admin.';

-- 3) Column-level grants: authenticated/anon cannot write role directly
REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.profiles TO anon;
REVOKE UPDATE (role) ON TABLE public.profiles FROM authenticated;
REVOKE INSERT (role) ON TABLE public.profiles FROM authenticated;

-- service_role / postgres retain full access for admin tooling and triggers
GRANT ALL ON TABLE public.profiles TO postgres, service_role;
