import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getApprovedTopicHierarchy } from '@/lib/data/topics'

export async function GET() {
  try {
    const supabase = await createClient()
    const topics = await getApprovedTopicHierarchy(supabase)
    return NextResponse.json({ data: topics })
  } catch (error) {
    console.error('Failed to load topics:', error)
    return NextResponse.json(
      { error: 'Failed to load topics', message: 'Approved topic taxonomy is unavailable' },
      { status: 500 }
    )
  }
}
