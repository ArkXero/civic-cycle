-- Official post-meeting BoardDocs motions and safe refresh/summary replacement.

alter table public.meetings
  add column if not exists boarddocs_content_hash text,
  add column if not exists boarddocs_last_checked_at timestamptz,
  add column if not exists boarddocs_results_seen_at timestamptz,
  add column if not exists boarddocs_refresh_started_at timestamptz,
  add column if not exists boarddocs_refresh_token uuid,
  add column if not exists boarddocs_refresh_error text;

alter table public.meetings
  add constraint meetings_boarddocs_content_hash_check
  check (
    boarddocs_content_hash is null
    or boarddocs_content_hash ~ '^[0-9a-f]{64}$'
  );

create index meetings_boarddocs_poll_idx
  on public.meetings (meeting_date desc, boarddocs_last_checked_at)
  where source = 'boarddocs';

alter table public.summaries
  add column if not exists source_content_hash text,
  add column if not exists revision integer not null default 1,
  add column if not exists schema_version integer not null default 1,
  add column if not exists updated_at timestamptz not null default now();

alter table public.summaries
  add constraint summaries_source_content_hash_check
  check (
    source_content_hash is null
    or source_content_hash ~ '^[0-9a-f]{64}$'
  ),
  add constraint summaries_revision_check check (revision > 0),
  add constraint summaries_schema_version_check check (schema_version > 0);

-- Keep the newest historical summary before enforcing one summary per meeting.
delete from public.summaries as duplicate
using (
  select id, row_number() over (
    partition by meeting_id
    order by updated_at desc, created_at desc, id desc
  ) as summary_rank
  from public.summaries
) as ranked
where duplicate.id = ranked.id
  and ranked.summary_rank > 1;

create unique index summaries_meeting_id_unique_idx
  on public.summaries (meeting_id);

create table public.agenda_item_motions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  agenda_item_id uuid not null references public.agenda_items(id) on delete cascade,
  source_ordinal integer not null,
  content_hash text not null,
  raw_html text not null,
  raw_motion_text text not null,
  normalized_motion_text text not null,
  motion_type text not null,
  parent_ordinal integer,
  is_final boolean not null default false,
  is_superseded boolean not null default false,
  outcome text not null default 'unknown',
  vote_yes integer,
  vote_no integer,
  vote_abstain integer,
  mover text,
  seconder text,
  roll_call_yes text[] not null default '{}',
  roll_call_no text[] not null default '{}',
  roll_call_abstain text[] not null default '{}',
  parser_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agenda_item_motions_item_ordinal_key unique (agenda_item_id, source_ordinal),
  constraint agenda_item_motions_source_ordinal_check check (source_ordinal >= 0),
  constraint agenda_item_motions_parent_ordinal_check check (
    parent_ordinal is null
    or (parent_ordinal >= 0 and parent_ordinal < source_ordinal)
  ),
  constraint agenda_item_motions_content_hash_check check (content_hash ~ '^[0-9a-f]{64}$'),
  constraint agenda_item_motions_type_check check (
    motion_type in (
      'original',
      'main',
      'amendment',
      'amendment_to_amendment',
      'amended_amendment',
      'amended_final',
      'procedural',
      'postponed',
      'tabled',
      'withdrawn',
      'other'
    )
  ),
  constraint agenda_item_motions_outcome_check check (
    outcome in ('passed', 'failed', 'postponed', 'tabled', 'withdrawn', 'unknown')
  ),
  constraint agenda_item_motions_vote_yes_check check (vote_yes is null or vote_yes >= 0),
  constraint agenda_item_motions_vote_no_check check (vote_no is null or vote_no >= 0),
  constraint agenda_item_motions_vote_abstain_check check (vote_abstain is null or vote_abstain >= 0)
);

create index agenda_item_motions_meeting_order_idx
  on public.agenda_item_motions (meeting_id, agenda_item_id, source_ordinal);

create index agenda_item_motions_parent_idx
  on public.agenda_item_motions (agenda_item_id, parent_ordinal)
  where parent_ordinal is not null;

create index agenda_item_motions_final_idx
  on public.agenda_item_motions (meeting_id, is_final, source_ordinal)
  where is_final and not is_superseded;

alter table public.agenda_item_motions enable row level security;
revoke all on table public.agenda_item_motions from public, anon, authenticated;
grant select, insert, update, delete on table public.agenda_item_motions to service_role;

create or replace function public.replace_agenda_item_motions(
  target_meeting_id uuid,
  target_agenda_item_id uuid,
  new_motions jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if new_motions is null or jsonb_typeof(new_motions) is distinct from 'array' then
    raise exception 'new_motions must be a JSON array' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.agenda_items
    where id = target_agenda_item_id
      and meeting_id = target_meeting_id
  ) then
    raise exception 'agenda item does not belong to target meeting' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('boarddocs-motions:' || target_agenda_item_id::text, 0)
  );

  delete from public.agenda_item_motions
  where agenda_item_id = target_agenda_item_id;

  insert into public.agenda_item_motions (
    meeting_id,
    agenda_item_id,
    source_ordinal,
    content_hash,
    raw_html,
    raw_motion_text,
    normalized_motion_text,
    motion_type,
    parent_ordinal,
    is_final,
    is_superseded,
    outcome,
    vote_yes,
    vote_no,
    vote_abstain,
    mover,
    seconder,
    roll_call_yes,
    roll_call_no,
    roll_call_abstain,
    parser_version,
    updated_at
  )
  select
    target_meeting_id,
    target_agenda_item_id,
    motion.source_ordinal,
    motion.content_hash,
    motion.raw_html,
    motion.raw_motion_text,
    motion.normalized_motion_text,
    motion.motion_type,
    motion.parent_ordinal,
    motion.is_final,
    motion.is_superseded,
    motion.outcome,
    motion.vote_yes,
    motion.vote_no,
    motion.vote_abstain,
    motion.mover,
    motion.seconder,
    coalesce(motion.roll_call_yes, '{}'),
    coalesce(motion.roll_call_no, '{}'),
    coalesce(motion.roll_call_abstain, '{}'),
    motion.parser_version,
    now()
  from jsonb_to_recordset(new_motions) as motion(
    source_ordinal integer,
    content_hash text,
    raw_html text,
    raw_motion_text text,
    normalized_motion_text text,
    motion_type text,
    parent_ordinal integer,
    is_final boolean,
    is_superseded boolean,
    outcome text,
    vote_yes integer,
    vote_no integer,
    vote_abstain integer,
    mover text,
    seconder text,
    roll_call_yes text[],
    roll_call_no text[],
    roll_call_abstain text[],
    parser_version text
  )
  order by motion.source_ordinal;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

create or replace function public.try_begin_boarddocs_refresh(
  target_meeting_id uuid,
  lease_seconds integer default 900
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_token uuid := gen_random_uuid();
  acquired_token uuid;
begin
  if lease_seconds < 60 or lease_seconds > 3600 then
    raise exception 'lease_seconds must be between 60 and 3600' using errcode = '22023';
  end if;

  update public.meetings
  set boarddocs_refresh_token = new_token,
      boarddocs_refresh_started_at = now(),
      boarddocs_refresh_error = null
  where id = target_meeting_id
    and (
      boarddocs_refresh_token is null
      or boarddocs_refresh_started_at is null
      or boarddocs_refresh_started_at < now() - make_interval(secs => lease_seconds)
    )
  returning boarddocs_refresh_token into acquired_token;

  return acquired_token;
end;
$$;

create or replace function public.replace_boarddocs_meeting_content(
  target_meeting_id uuid,
  target_refresh_token uuid,
  new_title text,
  new_meeting_date date,
  new_content_hash text,
  new_transcript_text text,
  new_last_checked_at timestamptz,
  new_results_seen_at timestamptz,
  new_agenda_items jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_refresh_token uuid;
  incoming_item jsonb;
  incoming_document jsonb;
  persisted_agenda_item_id uuid;
begin
  if new_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'new_content_hash must be a SHA-256 hash' using errcode = '22023';
  end if;
  if new_agenda_items is null or jsonb_typeof(new_agenda_items) is distinct from 'array' then
    raise exception 'new_agenda_items must be a JSON array' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(new_agenda_items) as item(value)
    group by item.value ->> 'external_id'
    having count(*) > 1
  ) then
    raise exception 'new_agenda_items contains duplicate external IDs' using errcode = '22023';
  end if;

  -- Lock and verify the lease before replacing any public source data.
  select boarddocs_refresh_token
  into current_refresh_token
  from public.meetings
  where id = target_meeting_id
  for update;
  if not found or current_refresh_token is distinct from target_refresh_token then
    raise exception 'BoardDocs refresh lease was lost' using errcode = '55000';
  end if;

  for incoming_item in select value from jsonb_array_elements(new_agenda_items)
  loop
    insert into public.agenda_items (
      meeting_id,
      external_id,
      item_order,
      category,
      item_type,
      title,
      recommended_action,
      body_markdown,
      updated_at
    ) values (
      target_meeting_id,
      incoming_item ->> 'external_id',
      incoming_item ->> 'item_order',
      coalesce(incoming_item ->> 'category', ''),
      coalesce(incoming_item ->> 'item_type', ''),
      incoming_item ->> 'title',
      coalesce(incoming_item ->> 'recommended_action', ''),
      coalesce(incoming_item ->> 'body_markdown', ''),
      now()
    )
    on conflict (meeting_id, external_id) do update
    set item_order = excluded.item_order,
        category = excluded.category,
        item_type = excluded.item_type,
        title = excluded.title,
        recommended_action = excluded.recommended_action,
        body_markdown = excluded.body_markdown,
        updated_at = now()
    returning id into persisted_agenda_item_id;

    delete from public.agenda_item_motions
    where agenda_item_id = persisted_agenda_item_id;

    insert into public.agenda_item_motions (
      meeting_id,
      agenda_item_id,
      source_ordinal,
      content_hash,
      raw_html,
      raw_motion_text,
      normalized_motion_text,
      motion_type,
      parent_ordinal,
      is_final,
      is_superseded,
      outcome,
      vote_yes,
      vote_no,
      vote_abstain,
      mover,
      seconder,
      roll_call_yes,
      roll_call_no,
      roll_call_abstain,
      parser_version,
      updated_at
    )
    select
      target_meeting_id,
      persisted_agenda_item_id,
      motion.source_ordinal,
      motion.content_hash,
      motion.raw_html,
      motion.raw_motion_text,
      motion.normalized_motion_text,
      motion.motion_type,
      motion.parent_ordinal,
      motion.is_final,
      motion.is_superseded,
      motion.outcome,
      motion.vote_yes,
      motion.vote_no,
      motion.vote_abstain,
      motion.mover,
      motion.seconder,
      coalesce(motion.roll_call_yes, '{}'),
      coalesce(motion.roll_call_no, '{}'),
      coalesce(motion.roll_call_abstain, '{}'),
      motion.parser_version,
      now()
    from jsonb_to_recordset(coalesce(incoming_item -> 'motions', '[]'::jsonb)) as motion(
      source_ordinal integer,
      content_hash text,
      raw_html text,
      raw_motion_text text,
      normalized_motion_text text,
      motion_type text,
      parent_ordinal integer,
      is_final boolean,
      is_superseded boolean,
      outcome text,
      vote_yes integer,
      vote_no integer,
      vote_abstain integer,
      mover text,
      seconder text,
      roll_call_yes text[],
      roll_call_no text[],
      roll_call_abstain text[],
      parser_version text
    );

    for incoming_document in
      select value from jsonb_array_elements(coalesce(incoming_item -> 'documents', '[]'::jsonb))
    loop
      if incoming_document ->> 'checksum_sha256' is null then
        insert into public.meeting_documents (
          meeting_id, agenda_item_id, external_file_id, title, source_url,
          checksum_sha256, parser_name, parser_version, extracted_markdown,
          page_count, byte_size, extraction_status, error_details, updated_at
        ) values (
          target_meeting_id, persisted_agenda_item_id, incoming_document ->> 'external_file_id',
          incoming_document ->> 'title', incoming_document ->> 'source_url', null,
          incoming_document ->> 'parser_name', incoming_document ->> 'parser_version',
          incoming_document ->> 'extracted_markdown',
          nullif(incoming_document ->> 'page_count', '')::integer,
          nullif(incoming_document ->> 'byte_size', '')::bigint,
          coalesce(incoming_document ->> 'extraction_status', 'pending'),
          incoming_document ->> 'error_details', now()
        )
        on conflict (meeting_id, external_file_id) where checksum_sha256 is null do update
        set agenda_item_id = excluded.agenda_item_id,
            title = excluded.title,
            source_url = excluded.source_url,
            parser_name = excluded.parser_name,
            parser_version = excluded.parser_version,
            extracted_markdown = excluded.extracted_markdown,
            page_count = excluded.page_count,
            byte_size = excluded.byte_size,
            extraction_status = excluded.extraction_status,
            error_details = excluded.error_details,
            updated_at = now();
      else
        insert into public.meeting_documents (
          meeting_id, agenda_item_id, external_file_id, title, source_url,
          checksum_sha256, parser_name, parser_version, extracted_markdown,
          page_count, byte_size, extraction_status, error_details, updated_at
        ) values (
          target_meeting_id, persisted_agenda_item_id, incoming_document ->> 'external_file_id',
          incoming_document ->> 'title', incoming_document ->> 'source_url',
          incoming_document ->> 'checksum_sha256', incoming_document ->> 'parser_name',
          incoming_document ->> 'parser_version', incoming_document ->> 'extracted_markdown',
          nullif(incoming_document ->> 'page_count', '')::integer,
          nullif(incoming_document ->> 'byte_size', '')::bigint,
          coalesce(incoming_document ->> 'extraction_status', 'pending'),
          incoming_document ->> 'error_details', now()
        )
        on conflict (meeting_id, external_file_id, checksum_sha256) do update
        set agenda_item_id = excluded.agenda_item_id,
            title = excluded.title,
            source_url = excluded.source_url,
            parser_name = excluded.parser_name,
            parser_version = excluded.parser_version,
            extracted_markdown = excluded.extracted_markdown,
            page_count = excluded.page_count,
            byte_size = excluded.byte_size,
            extraction_status = excluded.extraction_status,
            error_details = excluded.error_details,
            updated_at = now();
      end if;
    end loop;
  end loop;

  delete from public.agenda_items as agenda_item
  where agenda_item.meeting_id = target_meeting_id
    and not exists (
      select 1
      from jsonb_array_elements(new_agenda_items) as item(value)
      where item.value ->> 'external_id' = agenda_item.external_id
    );

  update public.meetings
  set title = new_title,
      meeting_date = new_meeting_date,
      boarddocs_content_hash = new_content_hash,
      boarddocs_last_checked_at = new_last_checked_at,
      boarddocs_results_seen_at = coalesce(new_results_seen_at, boarddocs_results_seen_at),
      boarddocs_refresh_error = null,
      transcript_source = 'boarddocs',
      transcript_text = coalesce(new_transcript_text, transcript_text),
      error_message = null,
      updated_at = now()
  where id = target_meeting_id
    and boarddocs_refresh_token = target_refresh_token;
end;
$$;

create or replace function public.replace_meeting_summary(
  target_meeting_id uuid,
  new_summary_text text,
  new_topics text[],
  new_key_decisions jsonb,
  new_action_items jsonb,
  new_source_content_hash text,
  new_schema_version integer,
  expected_refresh_token uuid default null,
  expected_boarddocs_content_hash text default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_revision integer;
begin
  if new_source_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'new_source_content_hash must be a SHA-256 hash' using errcode = '22023';
  end if;

  if expected_boarddocs_content_hash is not null
    and expected_boarddocs_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'expected_boarddocs_content_hash must be a SHA-256 hash' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('meeting-summary:' || target_meeting_id::text, 0)
  );

  if expected_refresh_token is not null or expected_boarddocs_content_hash is not null then
    perform 1
    from public.meetings
    where id = target_meeting_id
      and (expected_refresh_token is null or boarddocs_refresh_token = expected_refresh_token)
      and (
        expected_boarddocs_content_hash is null
        or boarddocs_content_hash = expected_boarddocs_content_hash
      )
    for update;
    if not found then
      raise exception 'BoardDocs source changed or refresh lease was lost' using errcode = '55000';
    end if;
  end if;

  select coalesce(max(revision), 0) + 1
  into next_revision
  from public.summaries
  where meeting_id = target_meeting_id;

  insert into public.summaries (
    meeting_id,
    summary_text,
    topics,
    key_decisions,
    action_items,
    source_content_hash,
    revision,
    schema_version,
    updated_at
  ) values (
    target_meeting_id,
    new_summary_text,
    new_topics,
    new_key_decisions,
    new_action_items,
    new_source_content_hash,
    next_revision,
    new_schema_version,
    now()
  )
  on conflict (meeting_id) do update
  set summary_text = excluded.summary_text,
      topics = excluded.topics,
      key_decisions = excluded.key_decisions,
      action_items = excluded.action_items,
      source_content_hash = excluded.source_content_hash,
      revision = excluded.revision,
      schema_version = excluded.schema_version,
      updated_at = now();

  update public.meetings
  set status = 'summarized',
      error_message = null,
      updated_at = now()
  where id = target_meeting_id
    and (expected_refresh_token is null or boarddocs_refresh_token = expected_refresh_token);

  return next_revision;
end;
$$;

create or replace function public.mark_meeting_summary_failure(
  target_meeting_id uuid,
  failure_message text,
  expected_refresh_token uuid default null,
  expected_boarddocs_content_hash text default null
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if expected_boarddocs_content_hash is not null
    and expected_boarddocs_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'expected_boarddocs_content_hash must be a SHA-256 hash' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('meeting-summary:' || target_meeting_id::text, 0)
  );

  if expected_refresh_token is not null or expected_boarddocs_content_hash is not null then
    perform 1
    from public.meetings
    where id = target_meeting_id
      and (expected_refresh_token is null or boarddocs_refresh_token = expected_refresh_token)
      and (
        expected_boarddocs_content_hash is null
        or boarddocs_content_hash = expected_boarddocs_content_hash
      )
    for update;
    if not found then
      raise exception 'BoardDocs source changed or refresh lease was lost' using errcode = '55000';
    end if;
  end if;

  if exists (select 1 from public.summaries where meeting_id = target_meeting_id) then
    update public.meetings
    set status = 'summarized',
        boarddocs_refresh_error = failure_message,
        updated_at = now()
    where id = target_meeting_id;
    return false;
  end if;

  update public.meetings
  set status = 'failed',
      error_message = failure_message,
      updated_at = now()
  where id = target_meeting_id;
  return true;
end;
$$;

revoke all on function public.replace_agenda_item_motions(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.try_begin_boarddocs_refresh(uuid, integer) from public, anon, authenticated;
revoke all on function public.replace_boarddocs_meeting_content(uuid, uuid, text, date, text, text, timestamptz, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function public.replace_meeting_summary(uuid, text, text[], jsonb, jsonb, text, integer, uuid, text) from public, anon, authenticated;
revoke all on function public.mark_meeting_summary_failure(uuid, text, uuid, text) from public, anon, authenticated;

grant execute on function public.replace_agenda_item_motions(uuid, uuid, jsonb) to service_role;
grant execute on function public.try_begin_boarddocs_refresh(uuid, integer) to service_role;
grant execute on function public.replace_boarddocs_meeting_content(uuid, uuid, text, date, text, text, timestamptz, timestamptz, jsonb) to service_role;
grant execute on function public.replace_meeting_summary(uuid, text, text[], jsonb, jsonb, text, integer, uuid, text) to service_role;
grant execute on function public.mark_meeting_summary_failure(uuid, text, uuid, text) to service_role;
