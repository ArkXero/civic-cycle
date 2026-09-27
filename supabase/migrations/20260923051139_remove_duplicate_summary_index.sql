-- summaries_meeting_id_idx already enforces one summary per meeting. The
-- BoardDocs migration created a second identical unique index while repairing
-- historical duplicates, so remove only the redundant copy.
drop index if exists public.summaries_meeting_id_unique_idx;
