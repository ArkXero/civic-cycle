import { createAdminClient } from '@/lib/supabase/server'

interface ProfileRow {
  id: string
  email: string
  display_name: string | null
}

/**
 * JIT upsert a user_profiles row for a WorkOS user.
 * Lookup order: workos_user_id → email (legacy import match) → INSERT.
 */
export async function ensureUserProfile(
  workosUserId: string,
  email: string,
  displayName: string | null = null,
): Promise<ProfileRow> {
  const db = createAdminClient()

  // Fast path: existing row with workos_user_id
  const { data: byWorkosId } = await db
    .from('user_profiles')
    .select('id, email, display_name')
    .eq('workos_user_id', workosUserId)
    .maybeSingle()

  if (byWorkosId) return byWorkosId as ProfileRow

  // Legacy match: row created by Supabase trigger before migration (workos_user_id NULL)
  const { data: byEmail } = await db
    .from('user_profiles')
    .select('id, email, display_name')
    .eq('email', email)
    .is('workos_user_id', null)
    .maybeSingle()

  if (byEmail) {
    // Backfill workos_user_id on the legacy row
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .from('user_profiles')
      .update({ workos_user_id: workosUserId })
      .eq('id', (byEmail as ProfileRow).id)
    return byEmail as ProfileRow
  }

  // New user: insert
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inserted, error } = await (db as any)
    .from('user_profiles')
    .insert({ email, display_name: displayName, workos_user_id: workosUserId })
    .select('id, email, display_name')
    .single()

  if (error || !inserted) {
    throw new Error(`Failed to create user profile: ${error?.message ?? 'unknown error'}`)
  }
  return inserted as ProfileRow
}
