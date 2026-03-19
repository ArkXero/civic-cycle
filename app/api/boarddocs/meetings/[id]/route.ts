import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMeetingAgenda } from '@/lib/boarddocs'

// GET /api/boarddocs/meetings/[id] - Fetch agenda items for a meeting
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in' },
        { status: 401 }
      )
    }

    const agendaItems = await getMeetingAgenda(id)

    return NextResponse.json({
      data: agendaItems,
      count: agendaItems.length,
    })
  } catch (error) {
    console.error('Error fetching agenda:', error)
    return NextResponse.json(
      { error: 'Failed to fetch agenda', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
