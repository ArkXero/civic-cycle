-- ============================================================
-- WorkOS AuthKit migration — Phase 1B
-- Re-point FKs from auth.users(id) → user_profiles(id)
--
-- Why: auth.users won't have rows for WorkOS-created users.
-- user_profiles is now the canonical user identity table.
-- ON DELETE CASCADE preserved so deleting a profile cleans up roles/alerts.
--
-- digest_subscribers.user_id already references user_profiles(id) — no change.
-- ============================================================

-- ── user_roles ────────────────────────────────────────────────
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

-- ── alert_preferences ─────────────────────────────────────────
-- Original FK name may differ (origin migration is git-ignored).
-- Drop by common auto-generated name; safe if it doesn't exist.
ALTER TABLE public.alert_preferences
  DROP CONSTRAINT IF EXISTS alert_preferences_user_id_fkey;

ALTER TABLE public.alert_preferences
  ADD CONSTRAINT alert_preferences_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

-- ── alert_history ─────────────────────────────────────────────
ALTER TABLE public.alert_history
  DROP CONSTRAINT IF EXISTS alert_history_user_id_fkey;

ALTER TABLE public.alert_history
  ADD CONSTRAINT alert_history_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
