import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/auth/is-admin-server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const userIdSchema = z.string().uuid()

type UserProfileDetail = {
  id: string
  email: string
  display_name: string | null
  created_at: string
}

type AlertPreferenceDetail = {
  keyword: string
  is_active: boolean
  bodies: string[] | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const idResult = userIdSchema.safeParse(id)

    if (!idResult.success) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!await isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const adminClient = createAdminClient()
    const { data: authData, error: targetError } = await adminClient.auth.admin.getUserById(id)

    if (targetError || !authData.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const [profileResult, rolesResult, alertPrefsResult, emailsSentResult] = await Promise.all([
      adminClient
        .from('user_profiles')
        .select('id, email, display_name, created_at')
        .eq('id', id)
        .maybeSingle(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (adminClient.from('user_roles') as any)
        .select('role')
        .eq('user_id', id),
      adminClient
        .from('alert_preferences')
        .select('keyword, is_active, bodies')
        .eq('user_id', id)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
      adminClient
        .from('alert_history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', id)
        .eq('email_status', 'sent'),
    ])

    if (profileResult.error) {
      console.error('Failed to fetch user profile:', profileResult.error)
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 })
    }

    if (alertPrefsResult.error) {
      console.error('Failed to fetch alert preferences:', alertPrefsResult.error)
      return NextResponse.json({ error: 'Failed to fetch alert preferences' }, { status: 500 })
    }

    if (rolesResult.error) {
      console.error('Failed to fetch user roles:', rolesResult.error)
      return NextResponse.json({ error: 'Failed to fetch user roles' }, { status: 500 })
    }

    if (emailsSentResult.error) {
      console.error('Failed to fetch email count:', emailsSentResult.error)
      return NextResponse.json({ error: 'Failed to fetch email count' }, { status: 500 })
    }

    const roleRows = (rolesResult.data ?? []) as Array<{ role: 'admin' | 'user' }>
    const role = roleRows.some((row) => row.role === 'admin') ? 'admin' : 'user'
    const profile = profileResult.data as UserProfileDetail | null
    const authUser = authData.user
    const alertPreferences = (alertPrefsResult.data ?? []) as AlertPreferenceDetail[]

    return NextResponse.json({
      id,
      email: authUser.email ?? profile?.email ?? '(no email)',
      display_name: profile?.display_name ?? null,
      role,
      created_at: profile?.created_at ?? authUser.created_at,
      last_sign_in_at: authUser.last_sign_in_at ?? null,
      alert_preferences: alertPreferences.map((pref) => ({
        keyword: pref.keyword,
        is_active: pref.is_active,
        bodies: pref.bodies ?? [],
      })),
      emails_sent: emailsSentResult.count ?? 0,
    })
  } catch (error) {
    console.error('Route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
