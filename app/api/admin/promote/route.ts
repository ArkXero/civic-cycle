import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { z } from 'zod'

const promoteBodySchema = z.object({
  targetUserId: z.string().min(1),
}).strict()

// POST /api/admin/promote
// When USE_WORKOS_AUTH: targetUserId is a WorkOS user ID (user_xxx...).
// Legacy: targetUserId is a Supabase UUID.
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!currentUser.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const bodyResult = promoteBodySchema.safeParse(rawBody)
    if (!bodyResult.success) {
      return NextResponse.json({ error: bodyResult.error.issues[0].message }, { status: 400 })
    }

    const { targetUserId } = bodyResult.data
    const adminClient = createAdminClient()
    let internalProfileId: string

    if (process.env.USE_WORKOS_AUTH === 'true') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: profile, error: profileError } = await (adminClient.from('user_profiles') as any)
        .select('id')
        .eq('workos_user_id', targetUserId)
        .single()

      if (profileError || !profile) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      internalProfileId = profile.id
    } else {
      internalProfileId = targetUserId
    }

    if (internalProfileId === currentUser.profileId) {
      return NextResponse.json({ error: 'Cannot promote yourself' }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertError } = await (adminClient.from('user_roles') as any)
      .upsert(
        { user_id: internalProfileId, role: 'admin' },
        { onConflict: 'user_id,role' }
      )

    if (upsertError) {
      console.error('Failed to promote user:', upsertError)
      return NextResponse.json({ error: 'Failed to promote user' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
