import { NextRequest, NextResponse } from 'next/server'
import { isAdminUser } from '@/lib/auth/is-admin-server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const rangeSchema = z.enum(['7d', '30d', '90d', 'all']).default('30d')
type Range = z.infer<typeof rangeSchema>
type UserProfileCreatedAtRow = { created_at: string }

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

    if (range === 'all') {
      const { data, error } = await adminClient
        .from('user_profiles')
        .select('created_at')
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Failed to fetch user growth:', error)
        return NextResponse.json({ error: 'Failed to fetch user growth' }, { status: 500 })
      }

      const rows = (data ?? []) as UserProfileCreatedAtRow[]
      const counts = rows.reduce((acc, row) => {
        const key = toMonthKey(row.created_at)
        acc.set(key, (acc.get(key) ?? 0) + 1)
        return acc
      }, new Map<string, number>())

      const monthKeys = rows.length > 0
        ? eachMonthKey(monthStart(rows[0].created_at), monthStart(new Date().toISOString()))
        : []

      let cumulative = 0
      const points = monthKeys.map((date) => {
        const newSignups = counts.get(date) ?? 0
        cumulative += newSignups
        return { date, new_signups: newSignups, cumulative }
      })

      return NextResponse.json({ range, points })
    }

    const start = rangeStart(range)
    const startIso = start.toISOString()
    const [{ data, error }, startingCount] = await Promise.all([
      adminClient
        .from('user_profiles')
        .select('created_at')
        .gte('created_at', startIso)
        .order('created_at', { ascending: true }),
      adminClient
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .lt('created_at', startIso),
    ])

    if (error) {
      console.error('Failed to fetch user growth:', error)
      return NextResponse.json({ error: 'Failed to fetch user growth' }, { status: 500 })
    }

    if (startingCount.error) {
      console.error('Failed to fetch starting user count:', startingCount.error)
      return NextResponse.json({ error: 'Failed to fetch starting user count' }, { status: 500 })
    }

    const rows = (data ?? []) as UserProfileCreatedAtRow[]
    const counts = rows.reduce((acc, row) => {
      const key = toDateKey(row.created_at)
      acc.set(key, (acc.get(key) ?? 0) + 1)
      return acc
    }, new Map<string, number>())

    let cumulative = startingCount.count ?? 0
    const points = eachDayKey(start, startOfUtcDay(new Date())).map((date) => {
      const newSignups = counts.get(date) ?? 0
      cumulative += newSignups
      return { date, new_signups: newSignups, cumulative }
    })

    return NextResponse.json({ range, points })
  } catch (error) {
    console.error('Route error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
