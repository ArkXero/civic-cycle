import { NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/auth/is-admin-server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export interface AdminUser {
  id: string
  email: string
  display_name: string | null
  role: 'admin' | 'user'
  created_at: string
  last_sign_in_at: string | null
  active_alert_count: number
}

type RoleRow = {
  user_id: string
  role: 'admin' | 'user'
}

type ProfileRow = {
  id: string
  display_name: string | null
}

type ActiveAlertRow = {
  user_id: string
  id: string
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

    const [rolesResult, profilesResult, activeAlertsResult] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (adminClient.from('user_roles') as any).select('user_id, role'),
      adminClient.from('user_profiles').select('id, display_name'),
      adminClient
        .from('alert_preferences')
        .select('user_id, id')
        .eq('is_active', true),
    ])

    if (rolesResult.error || profilesResult.error || activeAlertsResult.error) {
      console.error('Failed to fetch user metadata:', {
        roles: rolesResult.error,
        profiles: profilesResult.error,
        activeAlerts: activeAlertsResult.error,
      })
      return NextResponse.json({ error: 'Failed to fetch user metadata' }, { status: 500 })
    }

    const roleMap = new Map<string, 'admin' | 'user'>()
    const roles = (rolesResult.data ?? []) as RoleRow[]
    for (const role of roles) {
      if (role.role === 'admin') {
        roleMap.set(role.user_id, 'admin')
      } else if (!roleMap.has(role.user_id)) {
        roleMap.set(role.user_id, 'user')
      }
    }

    const profiles = (profilesResult.data ?? []) as ProfileRow[]
    const displayNameMap = new Map<string, string | null>(
      profiles.map((profile) => [profile.id, profile.display_name])
    )

    const activeAlertCountMap = new Map<string, number>()
    const activeAlerts = (activeAlertsResult.data ?? []) as ActiveAlertRow[]
    for (const alert of activeAlerts) {
      activeAlertCountMap.set(alert.user_id, (activeAlertCountMap.get(alert.user_id) ?? 0) + 1)
    }

    const users: AdminUser[] = authData.users.map((u) => ({
      id: u.id,
      email: u.email ?? '(no email)',
      display_name: displayNameMap.get(u.id) ?? null,
      role: roleMap.get(u.id) ?? 'user',
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      active_alert_count: activeAlertCountMap.get(u.id) ?? 0,
    }))

    return NextResponse.json({ users })
  } catch (error) {
    console.error('Route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
