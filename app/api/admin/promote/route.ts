import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const promoteBodySchema = z.object({
  targetUserId: z.string().uuid(),
}).strict()

// POST /api/admin/promote
// Promotes a user to the admin role.
// Caller must be authenticated AND have role = 'admin' in user_roles (DB double-check).
export async function POST(request: NextRequest) {
  try {
    // 1. Verify the caller is authenticated
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Double-check the caller has role = 'admin' in the DB (not just the JWT)
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: callerRole, error: roleError } = await (adminClient.from('user_roles') as any)
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()

    if (roleError || !callerRole) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. Parse and validate the request body
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

    // Prevent self-promotion (belt-and-suspenders — the caller already IS an admin,
    // but guard against accidental duplicate upserts causing confusion)
    if (targetUserId === user.id) {
      return NextResponse.json({ error: 'Cannot promote yourself' }, { status: 400 })
    }

    // 4. Upsert the target user's role to 'admin'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: upsertError } = await (adminClient.from('user_roles') as any)
      .upsert(
        { user_id: targetUserId, role: 'admin' },
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
