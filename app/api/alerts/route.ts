import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'
import { z } from 'zod'

const publicAlertSelect = 'id, keyword, bodies, is_active, created_at'

const createAlertSchema = z.object({
  keyword: z.string().min(2, 'Keyword must be at least 2 characters').max(100),
  bodies: z.array(z.string()).optional().default([]),
}).strict()

// GET /api/alerts - List user's alerts
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to view alerts' },
        { status: 401 }
      )
    }

    const { data: alerts, error } = await supabase
      .from('alert_preferences')
      .select(publicAlertSelect)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching alerts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch alerts' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: alerts })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}

// POST /api/alerts - Create a new alert
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in to create alerts' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validationResult = createAlertSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation error', message: validationResult.error.issues[0].message },
        { status: 400 }
      )
    }

    const { keyword, bodies } = validationResult.data

    // Check if user already has an alert for this keyword
    const { data: existing } = await supabase
      .from('alert_preferences')
      .select('id')
      .eq('user_id', user.id)
      .eq('keyword', keyword.toLowerCase())
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Duplicate alert', message: 'You already have an alert for this keyword' },
        { status: 409 }
      )
    }

    const { data: alert, error } = await supabase
      .from('alert_preferences')
      .insert({
        user_id: user.id,
        keyword: keyword.toLowerCase(),
        bodies,
        is_active: true,
        unsubscribe_token: randomBytes(32).toString('hex'),
      })
      .select(publicAlertSelect)
      .single()

    if (error) {
      console.error('Error creating alert:', error)
      return NextResponse.json(
        { error: 'Failed to create alert' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: alert }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
