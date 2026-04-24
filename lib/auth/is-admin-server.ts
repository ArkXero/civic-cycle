import { isAdminEmail } from '@/lib/is-admin'
import { createAdminClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * Server-only admin check. Returns true if user is admin via ADMIN_EMAILS env var
 * OR has role='admin' in user_roles table. Use in server components / route handlers.
 */
export async function isAdminUser(user: User): Promise<boolean> {
  if (isAdminEmail(user.email)) return true
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle()
  return !!data
}
