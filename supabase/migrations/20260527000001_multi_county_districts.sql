-- Multi-county school district support for BoardDocs imports, profiles, and digests.

-- ── meetings: district marker ────────────────────────────────────────────────
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS district_id TEXT NOT NULL DEFAULT 'fairfax';

UPDATE public.meetings
SET district_id = 'fairfax'
WHERE district_id IS NULL;

ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_district_id_check;

ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_district_id_check
  CHECK (district_id IN ('fairfax', 'loudoun', 'prince-william', 'arlington'));

CREATE INDEX IF NOT EXISTS idx_meetings_district_date
  ON public.meetings (district_id, meeting_date DESC);

-- ── user_profiles: preferred district ────────────────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS preferred_district_id TEXT;

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_preferred_district_id_check;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_preferred_district_id_check
  CHECK (
    preferred_district_id IS NULL
    OR preferred_district_id IN ('fairfax', 'loudoun', 'prince-william', 'arlington')
  );

CREATE INDEX IF NOT EXISTS idx_user_profiles_preferred_district
  ON public.user_profiles (preferred_district_id);

-- Read preferred_district_id from Supabase auth metadata for new email signups.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  preferred_district TEXT;
BEGIN
  preferred_district := NEW.raw_user_meta_data->>'preferred_district_id';

  IF preferred_district NOT IN ('fairfax', 'loudoun', 'prince-william', 'arlington') THEN
    preferred_district := NULL;
  END IF;

  INSERT INTO public.user_profiles (id, email, display_name, preferred_district_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    preferred_district
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── digest_subscribers: district marker ──────────────────────────────────────
ALTER TABLE public.digest_subscribers
  ADD COLUMN IF NOT EXISTS district_id TEXT NOT NULL DEFAULT 'fairfax';

UPDATE public.digest_subscribers
SET district_id = 'fairfax'
WHERE district_id IS NULL;

ALTER TABLE public.digest_subscribers
  DROP CONSTRAINT IF EXISTS digest_subscribers_district_id_check;

ALTER TABLE public.digest_subscribers
  ADD CONSTRAINT digest_subscribers_district_id_check
  CHECK (district_id IN ('fairfax', 'loudoun', 'prince-william', 'arlington'));

CREATE INDEX IF NOT EXISTS idx_digest_subscribers_district_active
  ON public.digest_subscribers (district_id, active)
  WHERE active = TRUE;

CREATE OR REPLACE FUNCTION public.handle_new_user_digest_subscribe()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.digest_subscribers (email, user_id, district_id)
  VALUES (NEW.email, NEW.id, COALESCE(NEW.preferred_district_id, 'fairfax'))
  ON CONFLICT (email) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_profile_created_subscribe_digest
  ON public.user_profiles;

CREATE TRIGGER on_user_profile_created_subscribe_digest
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_digest_subscribe();

CREATE OR REPLACE FUNCTION public.sync_digest_subscriber_district()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.digest_subscribers
  SET district_id = COALESCE(NEW.preferred_district_id, 'fairfax')
  WHERE user_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_user_profile_district_updated
  ON public.user_profiles;

CREATE TRIGGER on_user_profile_district_updated
  AFTER UPDATE OF preferred_district_id ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_digest_subscriber_district();
