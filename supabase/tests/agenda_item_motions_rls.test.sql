begin;
select plan(11);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.agenda_item_motions'::regclass),
  'agenda_item_motions has RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.agenda_item_motions', 'select'),
  'anon cannot select motions directly'
);
select ok(
  not has_table_privilege('anon', 'public.agenda_item_motions', 'insert,update,delete'),
  'anon cannot write motions'
);
select ok(
  not has_table_privilege('authenticated', 'public.agenda_item_motions', 'select'),
  'authenticated cannot select motions directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.agenda_item_motions', 'insert,update,delete'),
  'authenticated cannot write motions'
);
select ok(
  has_table_privilege('service_role', 'public.agenda_item_motions', 'select'),
  'service role can read motions for server rendering'
);
select ok(
  has_table_privilege('service_role', 'public.agenda_item_motions', 'insert,update,delete'),
  'service role can persist motions'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'agenda_item_motions'),
  0,
  'no client-facing RLS policy exposes private motions'
);

select ok(
  not exists (
    select 1
    from unnest(array[
      'public.replace_agenda_item_motions(uuid,uuid,jsonb)'::regprocedure,
      'public.try_begin_boarddocs_refresh(uuid,integer)'::regprocedure,
      'public.replace_boarddocs_meeting_content(uuid,uuid,text,date,text,text,timestamptz,timestamptz,jsonb)'::regprocedure,
      'public.replace_meeting_summary(uuid,text,text[],jsonb,jsonb,text,integer,uuid,text)'::regprocedure,
      'public.mark_meeting_summary_failure(uuid,text,uuid,text)'::regprocedure
    ]) as function_oid
    where has_function_privilege('anon', function_oid, 'execute')
  ),
  'anon cannot execute BoardDocs write RPCs'
);
select ok(
  not exists (
    select 1
    from unnest(array[
      'public.replace_agenda_item_motions(uuid,uuid,jsonb)'::regprocedure,
      'public.try_begin_boarddocs_refresh(uuid,integer)'::regprocedure,
      'public.replace_boarddocs_meeting_content(uuid,uuid,text,date,text,text,timestamptz,timestamptz,jsonb)'::regprocedure,
      'public.replace_meeting_summary(uuid,text,text[],jsonb,jsonb,text,integer,uuid,text)'::regprocedure,
      'public.mark_meeting_summary_failure(uuid,text,uuid,text)'::regprocedure
    ]) as function_oid
    where has_function_privilege('authenticated', function_oid, 'execute')
  ),
  'authenticated users cannot execute BoardDocs write RPCs'
);
select ok(
  not exists (
    select 1
    from unnest(array[
      'public.replace_agenda_item_motions(uuid,uuid,jsonb)'::regprocedure,
      'public.try_begin_boarddocs_refresh(uuid,integer)'::regprocedure,
      'public.replace_boarddocs_meeting_content(uuid,uuid,text,date,text,text,timestamptz,timestamptz,jsonb)'::regprocedure,
      'public.replace_meeting_summary(uuid,text,text[],jsonb,jsonb,text,integer,uuid,text)'::regprocedure,
      'public.mark_meeting_summary_failure(uuid,text,uuid,text)'::regprocedure
    ]) as function_oid
    where not has_function_privilege('service_role', function_oid, 'execute')
  ),
  'service role can execute every BoardDocs write RPC'
);

select * from finish();
rollback;
