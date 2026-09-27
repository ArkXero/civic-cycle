import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { getAccountProfile, getAuthenticatedUser } from '@/lib/account-profile'
import { isSchoolDistrictId } from '@/lib/school-districts'

const profileUpdateSchema = z
  .object({
    preferredDistrictId: z.string().refine(isSchoolDistrictId, 'Invalid district ID'),
  })
  .strict()

export async function GET() {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await getAccountProfile(supabase, user)

  return NextResponse.json({
    email: profile.email,
    preferredDistrictId: profile.preferredDistrictId,
  })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const user = await getAuthenticatedUser(supabase)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = profileUpdateSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    )
  }

  const adminClient = createAdminClient()
  const preferredDistrictId = result.data.preferredDistrictId

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: profileError } = await (adminClient as any)
    .from('user_profiles')
    .upsert({
      id: user.id,
      email: user.email ?? '',
      preferred_district_id: preferredDistrictId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })

  if (profileError) {
    console.error('account profile update failed:', profileError)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: digestError } = await (adminClient as any)
    .from('digest_subscribers')
    .update({ district_id: preferredDistrictId })
    .eq('user_id', user.id)

  if (digestError) {
    console.error('digest district sync failed:', digestError)
    return NextResponse.json({ error: 'Failed to update digest preference' }, { status: 500 })
  }

  return NextResponse.json({
    email: user.email ?? '',
    preferredDistrictId,
  })
}
