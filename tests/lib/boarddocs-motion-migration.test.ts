import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260828215944_boarddocs_motion_source_of_truth.sql'),
  'utf8'
)

describe('BoardDocs motion source-of-truth migration', () => {
  it('creates constrained motion storage with indexed foreign keys', () => {
    expect(migration).toContain('create table public.agenda_item_motions')
    expect(migration).toMatch(/meeting_id uuid not null references public\.meetings\(id\) on delete cascade/)
    expect(migration).toMatch(/agenda_item_id uuid not null references public\.agenda_items\(id\) on delete cascade/)
    expect(migration).toContain('agenda_item_motions_meeting_order_idx')
    expect(migration).toContain('agenda_item_motions_parent_idx')
    expect(migration).toContain('agenda_item_motions_item_ordinal_key')
  })

  it('keeps table private and service-role writes explicit', () => {
    expect(migration).toContain('alter table public.agenda_item_motions enable row level security')
    expect(migration).toContain('revoke all on table public.agenda_item_motions from public, anon, authenticated')
    expect(migration).toContain('grant select, insert, update, delete on table public.agenda_item_motions to service_role')
    expect(migration).not.toMatch(/create policy[\s\S]+agenda_item_motions/i)
  })

  it('provides transactional replacement and refresh lease RPCs only to service role', () => {
    const rpcNames = [
      'replace_agenda_item_motions',
      'try_begin_boarddocs_refresh',
      'replace_boarddocs_meeting_content',
      'replace_meeting_summary',
      'mark_meeting_summary_failure',
    ]
    for (const rpcName of rpcNames) {
      expect(migration).toContain(`function public.${rpcName}`)
      expect(migration).toMatch(new RegExp(
        `revoke all on function public\\.${rpcName}\\([\\s\\S]+?from public, anon, authenticated`
      ))
      expect(migration).toMatch(new RegExp(
        `grant execute on function public\\.${rpcName}\\([\\s\\S]+?to service_role`
      ))
    }
    expect(migration).toContain('BoardDocs refresh lease was lost')
    expect(migration).toContain('expected_boarddocs_content_hash')
    expect(migration).toContain('partition by meeting_id')
    expect(migration).toContain("hashtextextended('meeting-summary:'")
  })
})
