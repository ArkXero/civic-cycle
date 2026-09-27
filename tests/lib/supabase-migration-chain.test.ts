import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'

const migrationDirectory = join(process.cwd(), 'supabase/migrations')

function readMigration(fileName: string) {
  return readFileSync(join(migrationDirectory, fileName), 'utf8')
}

describe('Supabase migration chain', () => {
  it('starts with the schema baseline required by legacy migrations', () => {
    const migrations = readdirSync(migrationDirectory)
      .filter((fileName) => fileName.endsWith('.sql'))
      .sort()

    expect(migrations[0]).toBe('20260129190000_initial_schema_baseline.sql')
    expect(readMigration(migrations[0])).toContain('create table public.meetings')
    expect(readMigration(migrations[0])).toContain('create table public.summaries')
  })

  it('uses PostgreSQL-compatible policy creation in every migration', () => {
    const migrations = readdirSync(migrationDirectory).filter((fileName) =>
      fileName.endsWith('.sql')
    )

    for (const migration of migrations) {
      expect(readMigration(migration)).not.toMatch(/create policy if not exists/i)
    }
  })

  it('schema-qualifies extension functions in remotely pending migrations', () => {
    const migration = readMigration(
      '20260808060839_benchmark_topics_ingestion.sql'
    )

    expect(migration).not.toMatch(/(?<![.])\buuid_generate_v4\(\)/)
    expect(migration).toContain('extensions.uuid_generate_v4()')
  })

  it('does not require the production bootstrap user in a fresh auth schema', () => {
    const migration = readMigration('20260407000001_rbac.sql')

    expect(migration).toContain('FROM auth.users AS auth_user')
    expect(migration).toContain('ON CONFLICT (user_id, role) DO NOTHING')
  })

  it('restores alert keywords without discarding legacy history', () => {
    const migration = readMigration(
      '20260923044832_restore_alert_history_matched_keyword.sql'
    )

    expect(migration).toContain('set matched_keyword = preference.keyword')
    expect(migration).toContain("set matched_keyword = '[legacy unknown]'")
    expect(migration).toContain('alter column matched_keyword set not null')
    expect(migration).not.toMatch(/delete\s+from\s+public\.alert_history/i)
  })

  it('removes the duplicate summary meeting index after enforcing uniqueness', () => {
    const migration = readMigration(
      '20260923051139_remove_duplicate_summary_index.sql'
    )

    expect(migration).toContain(
      'drop index if exists public.summaries_meeting_id_unique_idx'
    )
    expect(migration).not.toContain('summaries_meeting_id_idx;')
  })

  it('aggregates admin analytics in Postgres without exposing the RPC to users', () => {
    const migration = readMigration(
      '20260923120621_admin_dashboard_analytics.sql'
    )

    expect(migration).toContain('cost_usd_micros bigint')
    expect(migration).toContain('create or replace function public.get_admin_dashboard_analytics')
    expect(migration).toContain('security invoker')
    expect(migration).toContain('revoke all on function public.get_admin_dashboard_analytics(text, text) from authenticated')
    expect(migration).toContain('grant execute on function public.get_admin_dashboard_analytics(text, text) to service_role')
    expect(migration).not.toMatch(/^\s*(begin|rollback);/im)
  })
})
