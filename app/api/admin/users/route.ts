import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { createAdminClient } from '@/lib/supabase/server'

export interface AdminUser {
  id: string
  email: string
  role: 'admin' | 'user'
  created_at: string
}

// GET /api/admin/users
export async function GET() {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!currentUser.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    if (process.env.USE_WORKOS_AUTH === 'true') {
      const { getWorkOSClient } = await import('@/lib/auth/workos')
      const workos = getWorkOSClient()
      const { data: workosUsers } = await workos.userManagement.listUsers({ limit: 100 })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profiles } = await (adminClient.from('user_profiles') as any)
        .select('id, email, workos_user_id')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: roles } = await (adminClient.from('user_roles') as any)
        .select('user_id, role')

      const profileByWorkosId = new Map<string, { id: string; email: string }>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (profiles ?? []).map((p: any) => [p.workos_user_id as string, p])
      )
      const roleMap = new Map<string, 'admin' | 'user'>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (roles ?? []).map((r: any) => [r.user_id as string, r.role as 'admin' | 'user'])
      )

      const users: AdminUser[] = workosUsers.map((u: { id: string; email: string; createdAt: string }) => {
        const profile = profileByWorkosId.get(u.id)
        const internalId = profile?.id ?? u.id
        return {
          id: u.id,
          email: u.email,
          role: roleMap.get(internalId) ?? 'user',
          created_at: u.createdAt,
        }
      })

      return NextResponse.json({ users })
    }

    // Supabase legacy path
    const { data: authData, error: usersError } = await adminClient.auth.admin.listUsers()
    if (usersError) {
      console.error('Failed to list users:', usersError)
      return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: roles } = await (adminClient.from('user_roles') as any)
      .select('user_id, role')

    const roleMap = new Map<string, 'admin' | 'user'>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (roles ?? []).map((r: any) => [r.user_id as string, r.role as 'admin' | 'user'])
    )

    const users: AdminUser[] = authData.users.map((u) => ({
      id: u.id,
      email: u.email ?? '(no email)',
      role: roleMap.get(u.id) ?? 'user',
      created_at: u.created_at,
    }))

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
