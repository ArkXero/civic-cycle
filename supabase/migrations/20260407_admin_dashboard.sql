-- Admin Dashboard: activity log and API usage tracking tables
-- Run in the Supabase SQL editor or via supabase db push

-- Activity log: records notable events across the system
CREATE TABLE IF NOT EXISTS activity_logs (
  id        BIGSERIAL PRIMARY KEY,
  action    VARCHAR(50)  NOT NULL,
  description TEXT        NOT NULL,
  metadata  JSONB,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action     ON activity_logs (action);

-- API usage: one row per Claude API call made during summarization
CREATE TABLE IF NOT EXISTS api_usage (
  id             BIGSERIAL PRIMARY KEY,
  meeting_id     UUID         REFERENCES meetings(id) ON DELETE SET NULL,
  model          VARCHAR(50)  NOT NULL,
  input_tokens   INTEGER      NOT NULL,
  output_tokens  INTEGER      NOT NULL,
  cost_cents     INTEGER      NOT NULL,  -- stored in cents to avoid float rounding
  success        BOOLEAN      NOT NULL DEFAULT TRUE,
  error_message  TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_created_at  ON api_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_meeting_id  ON api_usage (meeting_id);

-- RLS: only the service-role key (used by createAdminClient) can read/write these tables.
-- Regular authenticated users cannot access them at all.
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage     ENABLE ROW LEVEL SECURITY;

-- No policies = service-role bypasses RLS; anon/authenticated roles are denied by default.
