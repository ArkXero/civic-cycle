export type CurrentUser = {
  profileId: string
  email: string
  displayName: string | null
  isAdmin: boolean
  /** WorkOS user ID — only set when USE_WORKOS_AUTH=true */
  workosUserId?: string
}

/**
 * Unified server-side current-user helper.
 * When USE_WORKOS_AUTH=true → WorkOS session.
 * Otherwise → Supabase session (legacy path).
 *
 * Import lazily inside each branch to avoid bundling both auth SDKs together.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (process.env.USE_WORKOS_AUTH === 'true') {
    const { withAuth } = await import('@workos-inc/authkit-nextjs')
    const { user: workosUser } = await withAuth()
    if (!workosUser) return null

    const { ensureUserProfile } = await import('./ensure-profile')
    const { isAdminUser } = await import('./is-admin')

    const profile = await ensureUserProfile(
      workosUser.id,
      workosUser.email,
      workosUser.firstName ?? null,
    )
    const admin = await isAdminUser(workosUser.id, workosUser.email, profile.id)

    return {
      profileId: profile.id,
      email: workosUser.email,
      displayName: workosUser.firstName ?? null,
      isAdmin: admin,
      workosUserId: workosUser.id,
    }
  }

  // Supabase legacy path
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { isAdminUser: isAdminServer } = await import('./is-admin-server')
  const admin = await isAdminServer(user)

  return {
    profileId: user.id,
    email: user.email ?? '',
    displayName: user.user_metadata?.full_name ?? null,
    isAdmin: admin,
  }
}
