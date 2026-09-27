import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260509_add_search_vectors.sql'),
  'utf8'
)

describe('search vector migration', () => {
  it('does not use the stable array_to_string function in a generated column', () => {
    expect(migration).not.toMatch(
      /summaries[\s\S]+generated always as[\s\S]+array_to_string/i
    )
    expect(migration).toContain('CREATE TRIGGER summaries_search_vector_update')
    expect(migration).toContain('SECURITY INVOKER')
    expect(migration).toContain("SET search_path = ''")
  })

  it('keeps the trigger function private and backfills existing summaries', () => {
    expect(migration).toContain('UPDATE public.summaries')
    expect(migration).toMatch(
      /REVOKE EXECUTE ON FUNCTION public\.update_summary_search_vector\(\)[\s\S]+FROM public, anon, authenticated/
    )
    expect(migration).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.update_summary_search_vector\(\) TO service_role/
    )
  })
})
