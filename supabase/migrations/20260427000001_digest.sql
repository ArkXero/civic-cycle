-- Weekly digest: subscriber table + digest tracking columns on meetings

-- ── digest_subscribers ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS digest_subscribers (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email             TEXT        NOT NULL,
  user_id           UUID        REFERENCES user_profiles(id) ON DELETE SET NULL,
  subscribed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribe_token UUID        NOT NULL DEFAULT uuid_generate_v4(),
  active            BOOLEAN     NOT NULL DEFAULT TRUE,
  CONSTRAINT digest_subscribers_email_key UNIQUE (email),
  CONSTRAINT digest_subscribers_token_key UNIQUE (unsubscribe_token)
);

CREATE INDEX IF NOT EXISTS idx_digest_subscribers_user_id ON digest_subscribers (user_id);
CREATE INDEX IF NOT EXISTS idx_digest_subscribers_active  ON digest_subscribers (active) WHERE active = TRUE;

ALTER TABLE digest_subscribers ENABLE ROW LEVEL SECURITY;

-- Authenticated owner can read/delete their own row
DROP POLICY IF EXISTS "Digest subscribers: owner read" ON digest_subscribers;
CREATE POLICY "Digest subscribers: owner read"
  ON digest_subscribers FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Digest subscribers: owner delete" ON digest_subscribers;
CREATE POLICY "Digest subscribers: owner delete"
  ON digest_subscribers FOR DELETE
  USING (auth.uid() = user_id);

-- Service role bypasses RLS for all writes (subscribe, deactivate, send cron)

-- ── meetings: digest tracking columns ────────────────────────────────────────
ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS digest_sent    BOOLEAN     NOT NULL DEFAULT FALSE;

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS digest_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_meetings_digest_sent
  ON meetings (digest_sent) WHERE digest_sent = FALSE;

-- ── app_runtime grant ─────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.digest_subscribers TO app_runtime;
