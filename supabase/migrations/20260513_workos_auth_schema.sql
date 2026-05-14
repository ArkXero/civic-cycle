-- ============================================================
-- WorkOS AuthKit migration — Phase 1A
-- Safe to apply while Supabase Auth is still active.
--
-- What this does:
--   1. Add workos_user_id to user_profiles (WorkOS→internal UUID bridge)
--   2. Drop FK from user_profiles.id → auth.users(id)
--      New WorkOS users have no auth.users rows; app generates UUID directly.
--   3. Disable RLS on user-data tables (authz moves to app layer)
--   4. Drop policies that reference auth.uid() or auth.jwt()
--      Kept: users_select_published_summaries (no auth deps — safe to keep)
--      Kept: anon_select_published_summaries, anyone_select_meetings
--
-- NOTE: Supabase auth trigger (on_auth_user_created) and custom_access_token_hook
-- are intentionally NOT dropped here — they keep working during Phase 1→4 window
-- so new Supabase-auth signups still get user_profiles rows.
-- Those are dropped in Phase 4: 20260513_drop_supabase_auth_artifacts.sql
-- ============================================================

-- ── 1. Add WorkOS user ID bridge column ──────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS workos_user_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_user_profiles_workos_user_id
  ON public.user_profiles(workos_user_id);

-- ── 2. Drop FK from user_profiles.id → auth.users(id) ────────
-- Required: new WorkOS users will have no row in auth.users.
-- After this drop, user_profiles.id is a plain UUID PK generated
-- by ensureUserProfile() helper in app code.
ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

-- ── 3. Disable RLS on user-data tables ───────────────────────
-- All authz now runs in app code via createAdminClient() with explicit
-- user_id predicates. Service role was already used for most writes.
ALTER TABLE public.user_profiles      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_preferences  DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_history      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.digest_subscribers DISABLE ROW LEVEL SECURITY;

-- ── 4. Drop auth.uid() / auth.jwt() dependent policies ───────

-- user_profiles
DROP POLICY IF EXISTS "Users can read own profile"  ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

-- user_roles
DROP POLICY IF EXISTS "users_select_own_role" ON public.user_roles;

-- alert_preferences
DROP POLICY IF EXISTS "users_crud_own_alerts" ON public.alert_preferences;

-- digest_subscribers
DROP POLICY IF EXISTS "Digest subscribers: owner read"   ON public.digest_subscribers;
DROP POLICY IF EXISTS "Digest subscribers: owner delete" ON public.digest_subscribers;

-- summaries: only drop the JWT-role-gated admin policy.
-- "users_select_published_summaries" uses only published=TRUE (no auth.uid/jwt)
-- so it is safe to keep during Phase 1→4 window while Supabase auth is still live.
-- After WorkOS cutover all reads go via createAdminClient() anyway.
DROP POLICY IF EXISTS "admins_select_all_summaries" ON public.summaries;
-- "users_select_published_summaries" stays.
-- "anon_select_published_summaries" stays.
-- "anyone_select_meetings" stays.
