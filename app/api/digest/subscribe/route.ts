import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import {
  DEFAULT_SCHOOL_DISTRICT_ID,
  isSchoolDistrictId,
} from '@/lib/school-districts'

const schema = z
  .object({
    email: z.string().email(),
    userId: z.string().uuid().optional(),
    districtId: z.string().refine(isSchoolDistrictId).optional(),
  })
  .strict()

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const result = schema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0].message },
      { status: 400 }
    )
  }

  const { email, userId, districtId } = result.data
  const supabase = createAdminClient()
  let subscriberDistrictId = districtId ?? DEFAULT_SCHOOL_DISTRICT_ID

  if (userId && !districtId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from('user_profiles')
      .select('preferred_district_id')
      .eq('id', userId)
      .maybeSingle() as {
        data: { preferred_district_id: string | null } | null
      }

    if (isSchoolDistrictId(profile?.preferred_district_id)) {
      subscriberDistrictId = profile.preferred_district_id
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('digest_subscribers')
    .upsert(
      { email, user_id: userId ?? null, district_id: subscriberDistrictId, active: true },
      { onConflict: 'email', ignoreDuplicates: false }
    )

  if (error) {
    console.error('digest subscribe error:', error)
    return NextResponse.json({ error: 'Failed to subscribe' }, { status: 500 })
  }

  return NextResponse.json({ message: 'Subscribed' })
}
