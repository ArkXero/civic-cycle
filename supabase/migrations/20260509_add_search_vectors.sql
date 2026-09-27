-- Add FTS search vector to meetings (title + transcript_text)
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || coalesce(transcript_text, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS meetings_search_idx ON meetings USING GIN(search_vector);

-- array_to_string is STABLE rather than IMMUTABLE, so PostgreSQL does not
-- allow it in a generated column. Keep the summary vector current with a
-- trigger instead.
ALTER TABLE summaries ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION public.update_summary_search_vector()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.search_vector := to_tsvector(
    'pg_catalog.english'::regconfig,
    coalesce(NEW.summary_text, '') || ' ' || coalesce(array_to_string(NEW.topics, ' '), '')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS summaries_search_vector_update ON public.summaries;
CREATE TRIGGER summaries_search_vector_update
  BEFORE INSERT OR UPDATE OF summary_text, topics
  ON public.summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_summary_search_vector();

UPDATE public.summaries
SET search_vector = to_tsvector(
  'pg_catalog.english'::regconfig,
  coalesce(summary_text, '') || ' ' || coalesce(array_to_string(topics, ' '), '')
);

CREATE INDEX IF NOT EXISTS summaries_search_idx ON summaries USING GIN(search_vector);

REVOKE EXECUTE ON FUNCTION public.update_summary_search_vector()
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_summary_search_vector() TO service_role;
