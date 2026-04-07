-- ============================================================
-- RBAC: two-role system (admin / user)
-- ============================================================
-- After running this migration you MUST enable the Custom Access
-- Token Hook in the Supabase dashboard:
--   Authentication → Hooks → Custom Access Token Hook
--   Function: public.custom_access_token_hook
-- ============================================================

-- ── 1. Role enum ─────────────────────────────────────────────
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- ── 2. user_roles table ──────────────────────────────────────
CREATE TABLE public.user_roles (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID   NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        public.app_role NOT NULL DEFAULT 'user',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read their own role row
CREATE POLICY "users_select_own_role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- service_role bypasses RLS entirely — no write policies needed here.
-- All writes go through createAdminClient() which uses the service_role key.

-- ── 3. Custom Access Token Hook ──────────────────────────────
-- Injects `user_role` into every JWT claim set.
-- Default is 'user' when no row exists in user_roles.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims        JSONB;
  user_role_val TEXT;
BEGIN
  SELECT role::TEXT INTO user_role_val
  FROM public.user_roles
  WHERE user_id = (event->>'user_id')::UUID
  LIMIT 1;

  user_role_val := COALESCE(user_role_val, 'user');

  claims := event->'claims';
  claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role_val));

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Required grants so the auth subsystem can call the hook
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
-- Hook needs SELECT on user_roles to read roles (RLS blocks supabase_auth_admin otherwise)
GRANT SELECT ON TABLE public.user_roles TO supabase_auth_admin;

-- ── 4. summaries — add published flag ────────────────────────
ALTER TABLE public.summaries
  ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT TRUE;

-- All existing rows stay visible (DEFAULT TRUE).

ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;

-- Admins see everything (including unpublished)
CREATE POLICY "admins_select_all_summaries" ON public.summaries
  FOR SELECT TO authenticated
  USING ((SELECT auth.jwt()->>'user_role') = 'admin');

-- Logged-in non-admins see published only
CREATE POLICY "users_select_published_summaries" ON public.summaries
  FOR SELECT TO authenticated
  USING (published = TRUE);

-- Anonymous visitors see published only
CREATE POLICY "anon_select_published_summaries" ON public.summaries
  FOR SELECT TO anon
  USING (published = TRUE);

-- ── 5. meetings — public reads, service_role writes ──────────
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- Everyone (anon + authenticated) can read meetings
CREATE POLICY "anyone_select_meetings" ON public.meetings
  FOR SELECT USING (TRUE);

-- INSERT / UPDATE / DELETE: service_role only (bypasses RLS).
-- No explicit policy needed — absence of a permissive write policy
-- means only service_role (which skips RLS) can mutate rows.

-- ── 6. alert_preferences — users own their rows ──────────────
ALTER TABLE public.alert_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_crud_own_alerts" ON public.alert_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 7. Bootstrapping the first superuser ─────────────────────
-- Run this manually with a real UUID from auth.users:
--
INSERT INTO public.user_roles (user_id, role)
VALUES ('0cb82f82-5b20-49a0-b182-a46baef88c84', 'admin');
--
-- After inserting, the user must log out and back in (or wait
-- for their token to refresh) for the new role to appear in the JWT.
