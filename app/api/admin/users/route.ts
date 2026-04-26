import { NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/auth/is-admin-server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export interface AdminUser {
  id: string
  email: string
  role: 'admin' | 'user'
  created_at: string
}

// GET /api/admin/users
// Returns all auth users with their current role from user_roles.
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!await isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Fetch all auth users (service_role only)
    const { data: authData, error: usersError } = await adminClient.auth.admin.listUsers()
    if (usersError) {
      console.error('Failed to list users:', usersError)
      return NextResponse.json({ error: 'Failed to list users' }, { status: 500 })
    }

    // Fetch all role assignments
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
