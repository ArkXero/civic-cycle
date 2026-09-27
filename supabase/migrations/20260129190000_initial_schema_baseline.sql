-- Baseline for schema objects that predate the repository's migration history.
-- This migration is recorded as applied on the linked project because these
-- objects already exist there; it makes fresh local databases reproducible.

create extension if not exists "uuid-ossp" with schema extensions;

create table public.meetings (
  id uuid primary key default extensions.uuid_generate_v4(),
  title text not null,
  body text not null,
  meeting_date date not null,
  video_url text,
  transcript_url text,
  transcript_text text,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  fts tsvector generated always as (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || coalesce(transcript_text, '')
    )
  ) stored,
  youtube_video_id text,
  youtube_thumbnail_url text,
  youtube_duration text,
  youtube_published_at timestamptz,
  transcript_source text,
  external_id text unique,
  raw_content text,
  source_url text,
  source varchar(20),
  boarddocs_id varchar(100),
  constraint meetings_body_check check (
    body in ('FCPS School Board', 'Board of Supervisors')
  ),
  constraint meetings_status_check check (
    status in ('pending', 'processing', 'summarized', 'failed')
  ),
  constraint meetings_transcript_source_check check (
    transcript_source is null
    or transcript_source in (
      'youtube_auto',
      'youtube_manual',
      'manual_upload',
      'whisper'
    )
  )
);

create index meetings_body_idx on public.meetings (body);
create index meetings_date_idx on public.meetings (meeting_date desc);
create index meetings_fts_idx on public.meetings using gin (fts);
create index meetings_status_idx on public.meetings (status);
create index meetings_youtube_video_id_idx on public.meetings (youtube_video_id);
create index idx_meetings_boarddocs_id on public.meetings (boarddocs_id);

create table public.summaries (
  id uuid primary key default extensions.uuid_generate_v4(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  summary_text text not null,
  key_decisions jsonb default '[]'::jsonb,
  action_items jsonb default '[]'::jsonb,
  topics text[] default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  model_version text,
  sentiment text
);

create unique index summaries_meeting_id_idx on public.summaries (meeting_id);

create table public.alert_preferences (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  keyword text not null,
  is_active boolean default true,
  created_at timestamptz not null default timezone('utc', now())
);

create index alert_preferences_active_idx
  on public.alert_preferences (is_active)
  where is_active = true;
create index alert_preferences_user_id_idx
  on public.alert_preferences (user_id);

create table public.alert_history (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  alert_preference_id uuid references public.alert_preferences(id) on delete set null,
  sent_at timestamptz not null default timezone('utc', now()),
  email_status text not null default 'sent',
  constraint alert_history_email_status_check check (
    email_status in ('sent', 'failed', 'bounced')
  )
);

create index alert_history_user_id_idx on public.alert_history (user_id);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create trigger meetings_updated_at
  before update on public.meetings
  for each row execute function public.handle_updated_at();

alter table public.meetings enable row level security;
alter table public.summaries enable row level security;
alter table public.alert_preferences enable row level security;
alter table public.alert_history enable row level security;

create policy "Meetings are publicly readable"
  on public.meetings for select using (true);
create policy "Summaries are publicly readable"
  on public.summaries for select using (true);
create policy "Users can create own alerts"
  on public.alert_preferences for insert
  with check (auth.uid() = user_id);
create policy "Users can view own alerts"
  on public.alert_preferences for select
  using (auth.uid() = user_id);
create policy "Users can update own alerts"
  on public.alert_preferences for update
  using (auth.uid() = user_id);
create policy "Users can delete own alerts"
  on public.alert_preferences for delete
  using (auth.uid() = user_id);
create policy "Users can view own alert history"
  on public.alert_history for select
  using (auth.uid() = user_id);
