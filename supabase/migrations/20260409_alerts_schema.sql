-- Alert schema fixes:
-- 1. Add `bodies` column to alert_preferences (was missing from initial schema)
-- 2. Create user_profiles table (required by cron send-alerts route)
-- 3. Add trigger to auto-populate user_profiles from auth.users on signup

-- ── alert_preferences: add bodies column ─────────────────────────────────────
ALTER TABLE alert_preferences
  ADD COLUMN IF NOT EXISTS bodies TEXT[] DEFAULT '{}';

-- ── user_profiles table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  display_name TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- RLS: users can only read/update their own profile
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Service role can read all profiles (needed by cron send-alerts)
-- (service role bypasses RLS by default — no policy needed)

-- ── Trigger: auto-create profile on auth signup ───────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Backfill: create profiles for any existing auth users ─────────────────────
INSERT INTO user_profiles (id, email, display_name, created_at, updated_at)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name'),
  created_at,
  NOW()
FROM auth.users
ON CONFLICT (id) DO NOTHING;
