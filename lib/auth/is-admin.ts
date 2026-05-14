import { isAdminEmail } from '@/lib/is-admin'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * WorkOS-aware admin check.
 * Checks ADMIN_EMAILS env override first, then user_roles table using internal profileId.
 */
export async function isAdminUser(
  workosUserId: string,
  email: string | undefined,
  profileId?: string,
): Promise<boolean> {
  if (isAdminEmail(email)) return true
  if (!profileId) return false

  const db = createAdminClient()
  const { data } = await db
    .from('user_roles')
    .select('role')
    .eq('user_id', profileId)
    .eq('role', 'admin')
    .maybeSingle()
  return !!data
}
