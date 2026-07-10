import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/auth/is-admin-server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const rangeSchema = z.enum(['7d', '30d', '90d', 'all']).default('30d')
type Range = z.infer<typeof rangeSchema>
type CostUsageRow = {
  created_at: string
  meeting_id: string | null
  cost_cents: number
}

const DAY_MS = 24 * 60 * 60 * 1000

function toDateKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10)
}

function toMonthKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 7)
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function rangeStart(range: Exclude<Range, 'all'>) {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  return new Date(startOfUtcDay(new Date()).getTime() - (days - 1) * DAY_MS)
}

function eachDayKey(start: Date, end: Date) {
  const keys: string[] = []
  for (let cursor = start.getTime(); cursor <= end.getTime(); cursor += DAY_MS) {
    keys.push(new Date(cursor).toISOString().slice(0, 10))
  }
  return keys
}

function addMonth(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
}

function monthStart(iso: string) {
  const date = new Date(iso)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function eachMonthKey(start: Date, end: Date) {
  const keys: string[] = []
  for (let cursor = start; cursor <= end; cursor = addMonth(cursor)) {
    keys.push(cursor.toISOString().slice(0, 7))
  }
  return keys
}

type CostBucket = {
  cost_cents: number
  meetingIds: Set<string>
}

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

    const rangeResult = rangeSchema.safeParse(request.nextUrl.searchParams.get('range') ?? '30d')
    const range = rangeResult.success ? rangeResult.data : '30d'
    const adminClient = createAdminClient()
    const query = adminClient
      .from('api_usage')
      .select('created_at, meeting_id, cost_cents')
      .eq('success', true)
      .order('created_at', { ascending: true })

    const rangeQuery = range === 'all' ? query : query.gte('created_at', rangeStart(range).toISOString())
    const { data, error } = await rangeQuery

    if (error) {
      console.error('Failed to fetch cost timeline:', error)
      return NextResponse.json({ error: 'Failed to fetch cost timeline' }, { status: 500 })
    }

    const rows = (data ?? []) as CostUsageRow[]
    const buckets = rows.reduce((acc, row) => {
      const key = range === 'all' ? toMonthKey(row.created_at) : toDateKey(row.created_at)
      const bucket = acc.get(key) ?? { cost_cents: 0, meetingIds: new Set<string>() }
      bucket.cost_cents += row.cost_cents
      if (row.meeting_id) {
        bucket.meetingIds.add(row.meeting_id)
      }
      acc.set(key, bucket)
      return acc
    }, new Map<string, CostBucket>())

    const keys = range === 'all'
      ? rows.length > 0
        ? eachMonthKey(monthStart(rows[0].created_at), monthStart(new Date().toISOString()))
        : []
      : eachDayKey(rangeStart(range), startOfUtcDay(new Date()))

    const points = keys.map((date) => {
      const bucket = buckets.get(date) ?? { cost_cents: 0, meetingIds: new Set<string>() }
      return { date, cost_cents: bucket.cost_cents, summaries: bucket.meetingIds.size }
    })

    return NextResponse.json({
      range,
      points,
      total_cost_cents: points.reduce((sum, point) => sum + point.cost_cents, 0),
    })
  } catch (error) {
    console.error('Route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
