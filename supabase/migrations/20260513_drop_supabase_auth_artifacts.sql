-- ============================================================
-- WorkOS AuthKit migration — Phase 4 (apply AFTER cutover)
-- Drop Supabase Auth-specific triggers and functions.
--
-- Do NOT apply this during Phase 1 — dropping on_auth_user_created
-- while Supabase auth is still active will break new user sign-ups
-- (user_profiles rows won't be created for new Supabase auth users).
--
-- Pre-condition: WorkOS code path is live (USE_WORKOS_AUTH=true deployed).
-- Pre-condition: Custom Access Token Hook disabled in Supabase dashboard
--   Authentication → Hooks → Custom Access Token Hook → Disabled
-- ============================================================

-- on_auth_user_created trigger: fired on auth.users INSERT (Supabase signups).
-- Irrelevant after WorkOS cutover — profile bootstrap done JIT in app code.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- custom_access_token_hook: injected user_role into Supabase JWTs.
-- WorkOS issues its own JWTs; admin detection uses user_roles table query.
-- Disable in dashboard first, THEN run this migration.
-- Revoke grants before dropping — DROP removes all grants automatically
-- but explicit REVOKE first avoids any dependency edge cases.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'custom_access_token_hook'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(JSONB) FROM supabase_auth_admin;
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.custom_access_token_hook(JSONB);
