-- Make admin analytics complete beyond PostgREST's row cap and preserve
-- sub-cent API costs. The application calls this function only with the
-- server-side service-role client after its normal admin authorization check.

alter table public.api_usage
  add column if not exists cost_usd_micros bigint;

update public.api_usage
set cost_usd_micros = case model
  when 'claude-sonnet-4-6' then
    (input_tokens::bigint * 3) + (output_tokens::bigint * 15)
  when 'claude-haiku-4-5-20251001' then
    input_tokens::bigint + (output_tokens::bigint * 5)
  when 'claude-haiku-4-5' then
    input_tokens::bigint + (output_tokens::bigint * 5)
  else cost_cents::bigint * 10000
end
where cost_usd_micros is null;

alter table public.api_usage
  alter column cost_usd_micros set default 0,
  alter column cost_usd_micros set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'api_usage_cost_usd_micros_nonnegative'
      and conrelid = 'public.api_usage'::regclass
  ) then
    alter table public.api_usage
      add constraint api_usage_cost_usd_micros_nonnegative
      check (cost_usd_micros >= 0);
  end if;
end
$$;

create index if not exists idx_activity_logs_action_created_at
  on public.activity_logs (action, created_at desc);

create index if not exists idx_alert_history_sent_at
  on public.alert_history (sent_at desc);

create index if not exists idx_user_profiles_created_at
  on public.user_profiles (created_at desc);

create index if not exists idx_meetings_created_at
  on public.meetings (created_at desc);

create or replace function public.get_admin_dashboard_analytics(
  p_range text default '30d',
  p_timezone text default 'America/New_York'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_today date;
  v_start date;
  v_end date;
  v_previous_start date;
  v_bucket text;
  v_result jsonb;
begin
  if p_range not in ('7d', '30d', '90d', 'all') then
    raise exception 'Unsupported analytics range: %', p_range
      using errcode = '22023';
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Unsupported analytics timezone: %', p_timezone
      using errcode = '22023';
  end if;

  v_today := (v_now at time zone p_timezone)::date;
  v_end := v_today + 1;

  if p_range = '7d' then
    v_start := v_today - 6;
    v_bucket := 'day';
  elsif p_range = '30d' then
    v_start := v_today - 29;
    v_bucket := 'day';
  elsif p_range = '90d' then
    v_start := v_today - 89;
    v_bucket := 'day';
  else
    select coalesce(
      date_trunc('month', min(source_date)::timestamp)::date,
      date_trunc('month', v_today::timestamp)::date
    )
    into v_start
    from (
      select min(created_at at time zone p_timezone)::date as source_date from public.api_usage
      union all
      select min(created_at at time zone p_timezone)::date from public.activity_logs
      union all
      select min(created_at at time zone p_timezone)::date from public.user_profiles
      union all
      select min(sent_at at time zone p_timezone)::date from public.alert_history
    ) sources;
    v_bucket := 'month';
  end if;

  if p_range <> 'all' then
    v_previous_start := v_start - (v_end - v_start);
  end if;

  with
  bounds as (
    select
      v_start::timestamp at time zone p_timezone as starts_at,
      v_end::timestamp at time zone p_timezone as ends_at,
      case
        when v_previous_start is null then null
        else v_previous_start::timestamp at time zone p_timezone
      end as previous_starts_at
  ),
  current_processing as (
    select
      count(*) filter (where action = 'summary_generated')::bigint as succeeded,
      count(*) filter (where action = 'summary_failed')::bigint as failed
    from public.activity_logs, bounds
    where created_at >= bounds.starts_at and created_at < bounds.ends_at
  ),
  previous_processing as (
    select
      count(*) filter (where action = 'summary_generated')::bigint as succeeded,
      count(*) filter (where action = 'summary_failed')::bigint as failed
    from public.activity_logs, bounds
    where bounds.previous_starts_at is not null
      and created_at >= bounds.previous_starts_at
      and created_at < bounds.starts_at
  ),
  current_api as (
    select
      count(*)::bigint as calls,
      count(*) filter (where not success)::bigint as failed_calls,
      coalesce(sum(input_tokens), 0)::bigint as input_tokens,
      coalesce(sum(output_tokens), 0)::bigint as output_tokens,
      coalesce(sum(cost_usd_micros), 0)::bigint as cost_usd_micros
    from public.api_usage, bounds
    where created_at >= bounds.starts_at and created_at < bounds.ends_at
  ),
  previous_api as (
    select
      count(*)::bigint as calls,
      coalesce(sum(cost_usd_micros), 0)::bigint as cost_usd_micros
    from public.api_usage, bounds
    where bounds.previous_starts_at is not null
      and created_at >= bounds.previous_starts_at
      and created_at < bounds.starts_at
  ),
  current_users as (
    select count(*)::bigint as new_users
    from public.user_profiles, bounds
    where created_at >= bounds.starts_at and created_at < bounds.ends_at
  ),
  previous_users as (
    select count(*)::bigint as new_users
    from public.user_profiles, bounds
    where bounds.previous_starts_at is not null
      and created_at >= bounds.previous_starts_at
      and created_at < bounds.starts_at
  ),
  current_alerts as (
    select
      count(*) filter (where email_status = 'sent')::bigint as sent,
      count(*) filter (where email_status = 'failed')::bigint as failed,
      count(*) filter (where email_status = 'bounced')::bigint as bounced
    from public.alert_history, bounds
    where sent_at >= bounds.starts_at and sent_at < bounds.ends_at
  ),
  meeting_status as (
    select
      count(*)::bigint as total,
      count(*) filter (where status = 'pending')::bigint as pending,
      count(*) filter (where status = 'processing')::bigint as processing,
      count(*) filter (where status = 'failed')::bigint as failed,
      count(*) filter (where status = 'summarized')::bigint as summarized,
      count(*) filter (
        where status = 'processing' and updated_at < v_now - interval '15 minutes'
      )::bigint as stuck_processing
    from public.meetings
  ),
  buckets as (
    select bucket::date
    from pg_catalog.generate_series(
      v_start::timestamp,
      v_today::timestamp,
      case when v_bucket = 'month' then interval '1 month' else interval '1 day' end
    ) bucket
  ),
  processing_series as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'date', case when v_bucket = 'month' then to_char(b.bucket, 'YYYY-MM') else to_char(b.bucket, 'YYYY-MM-DD') end,
      'succeeded', coalesce(x.succeeded, 0),
      'failed', coalesce(x.failed, 0)
    ) order by b.bucket), '[]'::jsonb) as value
    from buckets b
    left join (
      select
        date_trunc(v_bucket, created_at at time zone p_timezone)::date as bucket,
        count(*) filter (where action = 'summary_generated')::bigint as succeeded,
        count(*) filter (where action = 'summary_failed')::bigint as failed
      from public.activity_logs, bounds
      where created_at >= bounds.starts_at and created_at < bounds.ends_at
      group by 1
    ) x using (bucket)
  ),
  user_series as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'date', case when v_bucket = 'month' then to_char(b.bucket, 'YYYY-MM') else to_char(b.bucket, 'YYYY-MM-DD') end,
      'new_users', coalesce(x.new_users, 0),
      'cumulative', (
        select count(*)::bigint
        from public.user_profiles p
        where p.created_at < (
          (b.bucket + case when v_bucket = 'month' then interval '1 month' else interval '1 day' end)::timestamp
          at time zone p_timezone
        )
      )
    ) order by b.bucket), '[]'::jsonb) as value
    from buckets b
    left join (
      select
        date_trunc(v_bucket, created_at at time zone p_timezone)::date as bucket,
        count(*)::bigint as new_users
      from public.user_profiles, bounds
      where created_at >= bounds.starts_at and created_at < bounds.ends_at
      group by 1
    ) x using (bucket)
  ),
  api_series as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'date', case when v_bucket = 'month' then to_char(b.bucket, 'YYYY-MM') else to_char(b.bucket, 'YYYY-MM-DD') end,
      'calls', coalesce(x.calls, 0),
      'failed_calls', coalesce(x.failed_calls, 0),
      'input_tokens', coalesce(x.input_tokens, 0),
      'output_tokens', coalesce(x.output_tokens, 0),
      'cost_usd_micros', coalesce(x.cost_usd_micros, 0),
      'meetings', coalesce(x.meetings, 0)
    ) order by b.bucket), '[]'::jsonb) as value
    from buckets b
    left join (
      select
        date_trunc(v_bucket, created_at at time zone p_timezone)::date as bucket,
        count(*)::bigint as calls,
        count(*) filter (where not success)::bigint as failed_calls,
        coalesce(sum(input_tokens), 0)::bigint as input_tokens,
        coalesce(sum(output_tokens), 0)::bigint as output_tokens,
        coalesce(sum(cost_usd_micros), 0)::bigint as cost_usd_micros,
        count(distinct meeting_id)::bigint as meetings
      from public.api_usage, bounds
      where created_at >= bounds.starts_at and created_at < bounds.ends_at
      group by 1
    ) x using (bucket)
  ),
  alert_series as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'date', case when v_bucket = 'month' then to_char(b.bucket, 'YYYY-MM') else to_char(b.bucket, 'YYYY-MM-DD') end,
      'sent', coalesce(x.sent, 0),
      'failed', coalesce(x.failed, 0),
      'bounced', coalesce(x.bounced, 0)
    ) order by b.bucket), '[]'::jsonb) as value
    from buckets b
    left join (
      select
        date_trunc(v_bucket, sent_at at time zone p_timezone)::date as bucket,
        count(*) filter (where email_status = 'sent')::bigint as sent,
        count(*) filter (where email_status = 'failed')::bigint as failed,
        count(*) filter (where email_status = 'bounced')::bigint as bounced
      from public.alert_history, bounds
      where sent_at >= bounds.starts_at and sent_at < bounds.ends_at
      group by 1
    ) x using (bucket)
  ),
  recent_activity as (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', item.id,
      'action', item.action,
      'description', item.description,
      'created_at', item.created_at,
      'metadata', item.metadata
    ) order by item.created_at desc), '[]'::jsonb) as value
    from (
      select id, action, description, created_at, metadata
      from public.activity_logs
      order by created_at desc
      limit 20
    ) item
  )
  select jsonb_build_object(
    'as_of', v_now,
    'range', p_range,
    'timezone', p_timezone,
    'kpis', jsonb_build_object(
      'meetings', jsonb_build_object(
        'total', meeting_status.total,
        'imported', (
          select count(*)::bigint from public.meetings, bounds
          where created_at >= bounds.starts_at and created_at < bounds.ends_at
        )
      ),
      'processing', jsonb_build_object(
        'succeeded', current_processing.succeeded,
        'failed', current_processing.failed,
        'success_rate', case
          when current_processing.succeeded + current_processing.failed = 0 then null
          else round(
            current_processing.succeeded::numeric * 100 /
            (current_processing.succeeded + current_processing.failed), 1
          )
        end
      ),
      'users', jsonb_build_object(
        'total', (select count(*)::bigint from public.user_profiles),
        'new_users', current_users.new_users
      ),
      'alerts', jsonb_build_object(
        'active_rules', (select count(*)::bigint from public.alert_preferences where is_active),
        'subscribers', (select count(distinct user_id)::bigint from public.alert_preferences where is_active),
        'sent', current_alerts.sent,
        'failed', current_alerts.failed,
        'bounced', current_alerts.bounced
      ),
      'api', to_jsonb(current_api),
      'previous', case when v_previous_start is null then null else jsonb_build_object(
        'processing_succeeded', previous_processing.succeeded,
        'processing_failed', previous_processing.failed,
        'new_users', previous_users.new_users,
        'api_calls', previous_api.calls,
        'api_cost_usd_micros', previous_api.cost_usd_micros
      ) end
    ),
    'meeting_status', to_jsonb(meeting_status),
    'series', jsonb_build_object(
      'processing', processing_series.value,
      'users', user_series.value,
      'api', api_series.value,
      'alerts', alert_series.value
    ),
    'recent_activity', recent_activity.value,
    'data_quality', jsonb_build_object(
      'unknown_pricing_calls', (
        select count(*)::bigint
        from public.api_usage, bounds
        where created_at >= bounds.starts_at
          and created_at < bounds.ends_at
          and model not in (
            'claude-sonnet-4-6',
            'claude-haiku-4-5-20251001',
            'claude-haiku-4-5'
          )
      )
    )
  )
  into v_result
  from current_processing,
       previous_processing,
       current_api,
       previous_api,
       current_users,
       previous_users,
       current_alerts,
       meeting_status,
       processing_series,
       user_series,
       api_series,
       alert_series,
       recent_activity;

  return v_result;
end;
$$;

revoke all on function public.get_admin_dashboard_analytics(text, text) from public;
revoke all on function public.get_admin_dashboard_analytics(text, text) from anon;
revoke all on function public.get_admin_dashboard_analytics(text, text) from authenticated;
grant execute on function public.get_admin_dashboard_analytics(text, text) to service_role;
