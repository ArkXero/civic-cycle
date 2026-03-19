-- init.sql
-- This runs automatically when PostgreSQL container starts for the first time

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- MEETINGS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS meetings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    external_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT 'FCPS School Board',
    meeting_date DATE NOT NULL,
    source_url TEXT,
    raw_content TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_external_id ON meetings(external_id);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);

-- ===========================================
-- SUMMARIES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS summaries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE UNIQUE NOT NULL,
    summary_text TEXT NOT NULL,
    key_decisions JSONB DEFAULT '[]'::jsonb,
    action_items JSONB DEFAULT '[]'::jsonb,
    topics TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- USERS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ===========================================
-- ALERT PREFERENCES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS alert_preferences (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    keyword TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON alert_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alert_preferences(is_active) WHERE is_active = TRUE;

-- ===========================================
-- ALERT HISTORY TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS alert_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE NOT NULL,
    alert_preference_id UUID REFERENCES alert_preferences(id) ON DELETE SET NULL,
    matched_keyword TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    email_status TEXT DEFAULT 'sent'
);

-- ===========================================
-- UPDATED_AT TRIGGER
-- ===========================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meetings_updated_at
    BEFORE UPDATE ON meetings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- BOARDDOCS SUPPORT
-- ===========================================
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT NULL;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS boarddocs_id VARCHAR(100);
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS source_url TEXT;

CREATE INDEX IF NOT EXISTS idx_meetings_boarddocs_id ON meetings(boarddocs_id);

-- ===========================================
-- DONE
-- ===========================================
SELECT 'Database initialized successfully!' AS status;
