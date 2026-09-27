-- Auto-subscribe all users to the weekly digest.
-- New users are subscribed via trigger on user_profiles INSERT.
-- Existing users are backfilled below.

CREATE OR REPLACE FUNCTION handle_new_user_digest_subscribe()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.digest_subscribers (email, user_id)
  VALUES (NEW.email, NEW.id)
  ON CONFLICT (email) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_profile_created_subscribe_digest
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_user_digest_subscribe();

-- Backfill existing users
INSERT INTO public.digest_subscribers (email, user_id)
SELECT email, id FROM public.user_profiles
ON CONFLICT (email) DO NOTHING;
