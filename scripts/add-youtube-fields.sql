-- Add YouTube-specific columns to meetings table
-- Run this in Supabase SQL Editor

ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS youtube_video_id text;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS youtube_thumbnail_url text;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS youtube_duration text;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS youtube_published_at timestamp with time zone;
ALTER TABLE public.meetings ADD COLUMN IF NOT EXISTS transcript_source text CHECK (transcript_source IN ('youtube_auto', 'youtube_manual', 'manual_upload', 'whisper'));

-- Index for faster lookups by YouTube video ID
CREATE INDEX IF NOT EXISTS meetings_youtube_video_id_idx ON public.meetings(youtube_video_id);

-- Verify the columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'meetings'
  AND column_name LIKE 'youtube%' OR column_name = 'transcript_source';
