-- Benchmark-first BoardDocs attachment ingestion and approved topic taxonomy.
-- Raw files are never persisted; only bounded extraction output and provenance are stored.

create table public.agenda_items (
  id uuid primary key default uuid_generate_v4(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  external_id text not null,
  item_order text not null,
  category text not null default '',
  item_type text not null default '',
  title text not null,
  recommended_action text not null default '',
  body_markdown text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agenda_items_meeting_external_key unique (meeting_id, external_id)
);

create index agenda_items_meeting_order_idx
  on public.agenda_items (meeting_id, item_order);

create table public.meeting_documents (
  id uuid primary key default uuid_generate_v4(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  agenda_item_id uuid not null references public.agenda_items(id) on delete cascade,
  external_file_id text not null,
  title text not null,
  source_url text not null,
  checksum_sha256 text,
  parser_name text,
  parser_version text,
  extracted_markdown text,
  page_count integer,
  byte_size bigint,
  extraction_status text not null default 'pending',
  error_details text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_documents_status_check check (
    extraction_status in ('pending', 'processing', 'extracted', 'failed', 'rejected')
  ),
  constraint meeting_documents_page_count_check check (
    page_count is null or page_count between 1 and 200
  ),
  constraint meeting_documents_byte_size_check check (
    byte_size is null or byte_size between 0 and 20971520
  ),
  constraint meeting_documents_checksum_check check (
    checksum_sha256 is null or checksum_sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint meeting_documents_source_url_check check (
    source_url ~ '^https://go[.]boarddocs[.]com/.+/Board[.]nsf/pfiles/.+/[$]file/.+'
  ),
  constraint meeting_documents_file_checksum_key unique (
    meeting_id,
    external_file_id,
    checksum_sha256
  )
);

create index meeting_documents_agenda_item_idx
  on public.meeting_documents (agenda_item_id);
create index meeting_documents_meeting_status_idx
  on public.meeting_documents (meeting_id, extraction_status);
create index meeting_documents_status_idx
  on public.meeting_documents (extraction_status, updated_at);
create unique index meeting_documents_failed_file_idx
  on public.meeting_documents (meeting_id, external_file_id)
  where checksum_sha256 is null;

create table public.topics (
  id uuid primary key default uuid_generate_v4(),
  slug text not null unique,
  display_name text not null,
  description text not null default '',
  parent_id uuid references public.topics(id) on delete set null,
  synonyms text[] not null default '{}',
  active boolean not null default true,
  taxonomy_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint topics_slug_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint topics_taxonomy_version_check check (taxonomy_version > 0)
);

create index topics_parent_idx on public.topics (parent_id);
create index topics_active_parent_idx on public.topics (active, parent_id);

create table public.agenda_item_topics (
  agenda_item_id uuid not null references public.agenda_items(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  confidence numeric(5,4) not null,
  rationale text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  classifier_version text not null,
  review_status text not null default 'pending',
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (agenda_item_id, topic_id),
  constraint agenda_item_topics_confidence_check check (
    confidence between 0 and 1
  ),
  constraint agenda_item_topics_review_status_check check (
    review_status in ('pending', 'approved', 'rejected')
  ),
  constraint agenda_item_topics_evidence_array_check check (
    jsonb_typeof(evidence) = 'array'
  )
);

create index agenda_item_topics_topic_review_idx
  on public.agenda_item_topics (topic_id, review_status);

create table public.meeting_topics (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  topic_id uuid not null references public.topics(id) on delete cascade,
  assignment_count integer not null,
  max_confidence numeric(5,4) not null,
  generated_at timestamptz not null default now(),
  primary key (meeting_id, topic_id),
  constraint meeting_topics_assignment_count_check check (assignment_count > 0),
  constraint meeting_topics_confidence_check check (max_confidence between 0 and 1)
);

create index meeting_topics_topic_meeting_idx
  on public.meeting_topics (topic_id, meeting_id);

create table public.topic_suggestions (
  id uuid primary key default uuid_generate_v4(),
  proposed_slug text not null,
  proposed_name text not null,
  rationale text not null default '',
  examples jsonb not null default '[]'::jsonb,
  occurrence_count integer not null default 1,
  review_state text not null default 'pending',
  merged_topic_id uuid references public.topics(id) on delete set null,
  classifier_version text not null,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint topic_suggestions_slug_classifier_key unique (proposed_slug, classifier_version),
  constraint topic_suggestions_slug_check check (
    proposed_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  constraint topic_suggestions_occurrence_count_check check (occurrence_count > 0),
  constraint topic_suggestions_review_state_check check (
    review_state in ('pending', 'approved', 'rejected', 'merged')
  ),
  constraint topic_suggestions_examples_array_check check (
    jsonb_typeof(examples) = 'array'
  )
);

create index topic_suggestions_review_state_idx
  on public.topic_suggestions (review_state, occurrence_count desc);
create index topic_suggestions_merged_topic_idx
  on public.topic_suggestions (merged_topic_id)
  where merged_topic_id is not null;

create or replace function public.refresh_meeting_topics(target_meeting_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  delete from public.meeting_topics
  where meeting_id = target_meeting_id;

  insert into public.meeting_topics (
    meeting_id,
    topic_id,
    assignment_count,
    max_confidence,
    generated_at
  )
  select
    ai.meeting_id,
    ait.topic_id,
    count(*)::integer,
    max(ait.confidence),
    now()
  from public.agenda_items ai
  join public.agenda_item_topics ait on ait.agenda_item_id = ai.id
  join public.topics t on t.id = ait.topic_id
  where ai.meeting_id = target_meeting_id
    and ait.review_status = 'approved'
    and t.active
  group by ai.meeting_id, ait.topic_id;
$$;

create or replace function public.replace_meeting_topic_assignments(
  target_meeting_id uuid,
  new_assignments jsonb
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_count integer;
begin
  if new_assignments is null or jsonb_typeof(new_assignments) is distinct from 'array' then
    raise exception 'new_assignments must be a JSON array' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(new_assignments) as assignment(agenda_item_id uuid)
    left join public.agenda_items ai
      on ai.id = assignment.agenda_item_id
      and ai.meeting_id = target_meeting_id
    where ai.id is null
  ) then
    raise exception 'assignment agenda item does not belong to target meeting'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('meeting-topic-retag:' || target_meeting_id::text, 0)
  );

  delete from public.agenda_item_topics ait
  using public.agenda_items ai
  where ait.agenda_item_id = ai.id
    and ai.meeting_id = target_meeting_id
    and ait.reviewed_at is null;

  insert into public.agenda_item_topics (
    agenda_item_id,
    topic_id,
    confidence,
    rationale,
    evidence,
    classifier_version,
    review_status,
    reviewed_at,
    updated_at
  )
  select
    assignment.agenda_item_id,
    assignment.topic_id,
    assignment.confidence,
    assignment.rationale,
    assignment.evidence,
    assignment.classifier_version,
    assignment.review_status,
    null,
    now()
  from jsonb_to_recordset(new_assignments) as assignment(
    agenda_item_id uuid,
    topic_id uuid,
    confidence numeric,
    rationale text,
    evidence jsonb,
    classifier_version text,
    review_status text
  )
  on conflict (agenda_item_id, topic_id) do nothing;

  get diagnostics inserted_count = row_count;
  perform public.refresh_meeting_topics(target_meeting_id);
  return inserted_count;
end;
$$;

create or replace function public.refresh_topic_meeting_rollups(target_topic_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_meeting_id uuid;
begin
  for target_meeting_id in
    select distinct ai.meeting_id
    from public.agenda_items ai
    join public.agenda_item_topics ait on ait.agenda_item_id = ai.id
    where ait.topic_id = target_topic_id
  loop
    perform public.refresh_meeting_topics(target_meeting_id);
  end loop;
end;
$$;

alter table public.agenda_items enable row level security;
alter table public.meeting_documents enable row level security;
alter table public.topics enable row level security;
alter table public.agenda_item_topics enable row level security;
alter table public.meeting_topics enable row level security;
alter table public.topic_suggestions enable row level security;

create policy "public_read_active_topics"
  on public.topics for select
  to anon, authenticated
  using (active);

create policy "public_read_approved_agenda_item_topics"
  on public.agenda_item_topics for select
  to anon, authenticated
  using (
    review_status = 'approved'
    and exists (
      select 1 from public.topics
      where topics.id = agenda_item_topics.topic_id
        and topics.active
    )
  );

create policy "public_read_active_meeting_topics"
  on public.meeting_topics for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.topics
      where topics.id = meeting_topics.topic_id
        and topics.active
    )
  );

revoke all on
  public.agenda_items,
  public.meeting_documents,
  public.topics,
  public.agenda_item_topics,
  public.meeting_topics,
  public.topic_suggestions
from public, anon, authenticated;
grant select on public.topics, public.agenda_item_topics, public.meeting_topics
  to anon, authenticated;
grant select, insert, update, delete on
  public.agenda_items,
  public.meeting_documents,
  public.topics,
  public.agenda_item_topics,
  public.meeting_topics,
  public.topic_suggestions
to service_role;
grant execute on function public.refresh_meeting_topics(uuid) to service_role;
grant execute on function public.refresh_topic_meeting_rollups(uuid) to service_role;
grant execute on function public.replace_meeting_topic_assignments(uuid, jsonb) to service_role;
revoke execute on function public.refresh_meeting_topics(uuid) from public, anon, authenticated;
revoke execute on function public.refresh_topic_meeting_rollups(uuid) from public, anon, authenticated;
revoke execute on function public.replace_meeting_topic_assignments(uuid, jsonb) from public, anon, authenticated;
