import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { ActivityTypes, logActivity } from '@/lib/activity'
import { canDemoteAdmins } from '@/lib/auth/can-demote-admins'
import { isAdminUser } from '@/lib/auth/is-admin-server'
import { z } from 'zod'

const demoteBodySchema = z.object({
  targetUserId: z.string().uuid(),
}).strict()

// POST /api/admin/demote
// Demotes a user by deleting the admin role row. Do not upsert role='user'.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!await isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!canDemoteAdmins(user.email)) {
      return NextResponse.json({ error: 'Only owner admins can demote users' }, { status: 403 })
    }

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const bodyResult = demoteBodySchema.safeParse(rawBody)
    if (!bodyResult.success) {
      return NextResponse.json({ error: bodyResult.error.issues[0].message }, { status: 400 })
    }

    const { targetUserId } = bodyResult.data

    if (targetUserId === user.id) {
      return NextResponse.json({ error: 'Cannot demote yourself' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data: targetData } = await adminClient.auth.admin.getUserById(targetUserId)
    const targetEmail = targetData.user?.email ?? targetUserId

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (adminClient.from('user_roles') as any)
      .delete()
      .eq('user_id', targetUserId)
      .eq('role', 'admin')

    if (deleteError) {
      console.error('Failed to demote user:', deleteError)
      return NextResponse.json({ error: 'Failed to demote user' }, { status: 500 })
    }

    logActivity(
      ActivityTypes.USER_DEMOTED,
      `Demoted ${targetEmail} from admin`,
      { targetUserId }
    ).catch(() => {})

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
