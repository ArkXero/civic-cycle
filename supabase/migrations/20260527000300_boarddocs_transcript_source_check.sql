-- Allow BoardDocs imports to identify their transcript source.

ALTER TABLE public.meetings
  DROP CONSTRAINT IF EXISTS meetings_transcript_source_check;

ALTER TABLE public.meetings
  ADD CONSTRAINT meetings_transcript_source_check
  CHECK (
    transcript_source IS NULL
    OR transcript_source IN (
      'youtube_auto',
      'youtube_manual',
      'manual_upload',
      'whisper',
      'boarddocs'
    )
  );
