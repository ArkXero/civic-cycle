import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminUser } from '@/lib/auth/is-admin-server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import type { AdminAnalyticsResponse } from '@/types/admin-analytics'

export const dynamic = 'force-dynamic'

const rangeSchema = z.enum(['7d', '30d', '90d', 'all'])
const TIMEZONE = 'America/New_York'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!await isAdminUser(user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const parsedRange = rangeSchema.safeParse(
      request.nextUrl.searchParams.get('range') ?? '30d'
    )
    if (!parsedRange.success) {
      return NextResponse.json({ error: 'Invalid analytics range' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data, error } = await adminClient.rpc('get_admin_dashboard_analytics', {
      p_range: parsedRange.data,
      p_timezone: TIMEZONE,
    })

    if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
      console.error('Failed to fetch admin analytics:', error)
      return NextResponse.json({ error: 'Failed to fetch admin analytics' }, { status: 500 })
    }

    return NextResponse.json(data as unknown as AdminAnalyticsResponse, {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('Admin analytics route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
