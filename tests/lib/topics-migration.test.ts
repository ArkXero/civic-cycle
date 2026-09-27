import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vite-plus/test'

const migration = readFileSync(
  'supabase/migrations/20260808060839_benchmark_topics_ingestion.sql',
  'utf8'
).toLowerCase()

describe('topic ingestion migration security', () => {
  it('enables RLS on every new public table', () => {
    for (const table of [
      'agenda_items',
      'meeting_documents',
      'topics',
      'agenda_item_topics',
      'meeting_topics',
      'topic_suggestions',
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`)
    }
  })

  it('keeps rollup invoker-scoped and internal content unavailable to public roles', () => {
    expect(migration).toContain('security invoker')
    expect(migration).not.toContain('security definer')
    expect(migration).toMatch(
      /revoke all on[\s\S]*public\.agenda_items,[\s\S]*public\.meeting_documents,[\s\S]*public\.topic_suggestions[\s\S]*from public, anon, authenticated/
    )
    expect(migration).not.toContain('create role app_runtime')
    expect(migration).toContain('to service_role')
    expect(migration).toContain('refresh_topic_meeting_rollups')
    expect(migration).toContain('revoke execute on function public.refresh_topic_meeting_rollups(uuid) from public, anon, authenticated')
    expect(migration).toContain('replace_meeting_topic_assignments')
    expect(migration).toContain('revoke execute on function public.replace_meeting_topic_assignments(uuid, jsonb) from public, anon, authenticated')
    expect(migration).toContain("review_status = 'approved'")
  })

  it('replaces automatic assignments and meeting rollups in one transaction', () => {
    expect(migration).toMatch(
      /function public\.replace_meeting_topic_assignments[\s\S]*delete from public\.agenda_item_topics[\s\S]*insert into public\.agenda_item_topics[\s\S]*perform public\.refresh_meeting_topics/
    )
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toContain('ait.reviewed_at is null')
  })

  it('indexes attachment lookups and every non-primary foreign key', () => {
    expect(migration).toContain('meeting_documents_meeting_status_idx')
    expect(migration).toContain('meeting_documents_agenda_item_idx')
    expect(migration).toContain('topics_parent_idx')
    expect(migration).toContain('agenda_item_topics_topic_review_idx')
    expect(migration).toContain('meeting_topics_topic_meeting_idx')
    expect(migration).toContain('topic_suggestions_merged_topic_idx')
  })
})
