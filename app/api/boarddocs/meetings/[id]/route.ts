import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getMeetingAgenda } from '@/lib/boarddocs'

// GET /api/boarddocs/meetings/[id] - Fetch agenda items for a meeting
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const currentUser = await getCurrentUser()
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!currentUser.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const agendaItems = await getMeetingAgenda(id)

    return NextResponse.json({
      data: agendaItems,
      count: agendaItems.length,
    })
  } catch (error) {
    console.error('Error fetching agenda:', error)
    return NextResponse.json(
      { error: 'Failed to fetch agenda' },
      { status: 500 }
    )
  }
}
