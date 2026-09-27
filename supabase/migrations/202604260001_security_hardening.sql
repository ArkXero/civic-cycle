-- Security hardening:
-- 1. Replace alert UUID unsubscribe links with random high-entropy tokens.
-- 2. Create a least-privilege database role for direct SQL integrations.

ALTER TABLE public.alert_preferences
  ADD COLUMN IF NOT EXISTS unsubscribe_token TEXT;

UPDATE public.alert_preferences
SET unsubscribe_token = encode(gen_random_bytes(32), 'hex')
WHERE unsubscribe_token IS NULL;

ALTER TABLE public.alert_preferences
  ALTER COLUMN unsubscribe_token SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'alert_preferences_unsubscribe_token_key'
  ) THEN
    ALTER TABLE public.alert_preferences
      ADD CONSTRAINT alert_preferences_unsubscribe_token_key UNIQUE (unsubscribe_token);
  END IF;
END $$;

ALTER TABLE public.alert_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_runtime') THEN
    CREATE ROLE app_runtime NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.meetings,
  public.summaries,
  public.alert_preferences,
  public.alert_history,
  public.user_profiles,
  public.user_roles,
  public.activity_logs,
  public.api_usage
TO app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_runtime;
