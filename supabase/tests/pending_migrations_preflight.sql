-- Raise immediately when the pending production migrations leave an invalid
-- schema. This file is safe to run after deployment or inside a rollback-only
-- migration preflight transaction.
do $preflight$
declare
  rpc regprocedure;
begin
  if exists (
    select 1
    from unnest(array[
      'agenda_items',
      'meeting_documents',
      'topics',
      'agenda_item_topics',
      'meeting_topics',
      'topic_suggestions',
      'agenda_item_motions'
    ]) as expected(table_name)
    where to_regclass('public.' || expected.table_name) is null
  ) then
    raise exception 'pending migration table is missing';
  end if;

  if not exists (
    select 1
    from pg_attribute
    where attrelid = 'public.meetings'::regclass
      and attname = 'search_vector'
      and attgenerated = 's'
      and not attisdropped
  ) then
    raise exception 'meetings.search_vector is not generated';
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.summaries'::regclass
      and tgname = 'summaries_search_vector_update'
      and not tgisinternal
      and tgenabled <> 'D'
  ) then
    raise exception 'summaries search-vector trigger is missing or disabled';
  end if;

  if exists (
    select 1 from public.summaries where search_vector is null
  ) then
    raise exception 'existing summaries were not backfilled with search vectors';
  end if;

  if not exists (
    select 1
    from pg_attribute
    where attrelid = 'public.alert_history'::regclass
      and attname = 'matched_keyword'
      and attnotnull
      and not attisdropped
  ) then
    raise exception 'alert_history.matched_keyword is missing or nullable';
  end if;

  if not (
    select relrowsecurity
    from pg_class
    where oid = 'public.agenda_item_motions'::regclass
  ) then
    raise exception 'agenda_item_motions RLS is disabled';
  end if;

  if has_table_privilege('anon', 'public.agenda_item_motions', 'select,insert,update,delete')
    or has_table_privilege(
      'authenticated',
      'public.agenda_item_motions',
      'select,insert,update,delete'
    ) then
    raise exception 'client role can access private motion rows';
  end if;

  if not has_table_privilege(
    'service_role',
    'public.agenda_item_motions',
    'select,insert,update,delete'
  ) then
    raise exception 'service_role cannot persist private motion rows';
  end if;

  foreach rpc in array array[
    'public.replace_agenda_item_motions(uuid,uuid,jsonb)'::regprocedure,
    'public.try_begin_boarddocs_refresh(uuid,integer)'::regprocedure,
    'public.replace_boarddocs_meeting_content(uuid,uuid,text,date,text,text,timestamptz,timestamptz,jsonb)'::regprocedure,
    'public.replace_meeting_summary(uuid,text,text[],jsonb,jsonb,text,integer,uuid,text)'::regprocedure,
    'public.mark_meeting_summary_failure(uuid,text,uuid,text)'::regprocedure
  ]
  loop
    if has_function_privilege('anon', rpc, 'execute')
      or has_function_privilege('authenticated', rpc, 'execute') then
      raise exception 'client role can execute private RPC %', rpc;
    end if;
    if not has_function_privilege('service_role', rpc, 'execute') then
      raise exception 'service_role cannot execute private RPC %', rpc;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'summaries_meeting_id_idx'
      and indexdef ilike 'create unique index%'
  ) then
    raise exception 'one-summary-per-meeting index is missing';
  end if;

  if to_regclass('public.summaries_meeting_id_unique_idx') is not null then
    raise exception 'duplicate summary meeting index still exists';
  end if;
end
$preflight$;
