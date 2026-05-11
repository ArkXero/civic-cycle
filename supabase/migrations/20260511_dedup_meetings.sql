-- Collapse duplicate imported meetings and enforce source URL uniqueness.
--
-- Keep the oldest row per (source, source_url), re-point one summary to the
-- winner when needed, delete summaries left on losing rows, then delete losers.
-- The unique constraint allows multiple NULL source_url values while making
-- non-NULL BoardDocs imports safe for ON CONFLICT upserts.

CREATE TEMP TABLE tmp_meeting_dedup_losers ON COMMIT DROP AS
WITH winners AS (
  SELECT DISTINCT ON (source, source_url)
    id AS winner_id,
    source,
    source_url
  FROM meetings
  WHERE source_url IS NOT NULL
  ORDER BY source, source_url, created_at ASC NULLS LAST, id ASC
)
SELECT
  m.id AS loser_id,
  w.winner_id
FROM meetings m
JOIN winners w
  ON m.source IS NOT DISTINCT FROM w.source
  AND m.source_url = w.source_url
WHERE m.id <> w.winner_id;

-- Preserve usage/alert references before deleting duplicate meeting rows.
UPDATE api_usage au
SET meeting_id = l.winner_id
FROM tmp_meeting_dedup_losers l
WHERE au.meeting_id = l.loser_id;

UPDATE alert_history ah
SET meeting_id = l.winner_id
FROM tmp_meeting_dedup_losers l
WHERE ah.meeting_id = l.loser_id;

-- If the winning meeting has no summary, move the oldest loser summary over.
WITH summary_to_keep AS (
  SELECT DISTINCT ON (l.winner_id)
    s.id AS summary_id,
    l.winner_id
  FROM summaries s
  JOIN tmp_meeting_dedup_losers l ON s.meeting_id = l.loser_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM summaries existing
    WHERE existing.meeting_id = l.winner_id
  )
  ORDER BY l.winner_id, s.created_at ASC NULLS LAST, s.id ASC
)
UPDATE summaries s
SET meeting_id = summary_to_keep.winner_id
FROM summary_to_keep
WHERE s.id = summary_to_keep.summary_id;

-- Drop summaries still attached to losing duplicate rows.
DELETE FROM summaries s
USING tmp_meeting_dedup_losers l
WHERE s.meeting_id = l.loser_id;

-- Keep winner summary state coherent when a loser summary was moved.
UPDATE meetings m
SET status = 'summarized',
    error_message = NULL
FROM summaries s
WHERE s.meeting_id = m.id
  AND m.id IN (SELECT winner_id FROM tmp_meeting_dedup_losers)
  AND m.status <> 'summarized';

-- Preserve digest-sent state from duplicate rows.
WITH digest_rollup AS (
  SELECT
    l.winner_id,
    BOOL_OR(m.digest_sent) AS digest_sent,
    MAX(m.digest_sent_at) AS digest_sent_at
  FROM tmp_meeting_dedup_losers l
  JOIN meetings m ON m.id IN (l.winner_id, l.loser_id)
  GROUP BY l.winner_id
)
UPDATE meetings m
SET digest_sent = digest_rollup.digest_sent,
    digest_sent_at = COALESCE(m.digest_sent_at, digest_rollup.digest_sent_at)
FROM digest_rollup
WHERE m.id = digest_rollup.winner_id
  AND digest_rollup.digest_sent;

DELETE FROM meetings m
USING tmp_meeting_dedup_losers l
WHERE m.id = l.loser_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'meetings_source_source_url_key'
      AND conrelid = 'meetings'::regclass
  ) THEN
    ALTER TABLE meetings
      ADD CONSTRAINT meetings_source_source_url_key UNIQUE (source, source_url);
  END IF;
END $$;
