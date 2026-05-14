import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { createAdminClient } from '@/lib/supabase/server'
import { listMeetings, getBoardDocsUrl } from '@/lib/boarddocs'

// GET /api/boarddocs/meetings - List all BoardDocs meetings with import status
export async function GET() {
  try {
    const currentUser = await getCurrentUser()
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!currentUser.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const meetings = await listMeetings()

    // Fetch all already-imported BoardDocs meetings from the DB in one small query.
    // Using .in() with thousands of URLs silently fails in Supabase — cross-reference locally instead.
    // SSR client infers never for meetings table — adminClient avoids the cast.
    const adminClient = createAdminClient()
    const { data: existingMeetings } = await adminClient
      .from('meetings')
      .select('id, source_url, status')
      .eq('source', 'boarddocs') as unknown as {
        data: { id: string; source_url: string; status: string }[] | null
      }

    const importedMap = new Map<string, { id: string; status: string }>(
      existingMeetings?.map((m) => [
        m.source_url,
        { id: m.id, status: m.status },
      ]) || []
    )

    const meetingsWithStatus = meetings.map((meeting) => {
      const sourceUrl = getBoardDocsUrl(meeting.id)
      const dbRow = importedMap.get(sourceUrl)
      return {
        ...meeting,
        date: meeting.date.toISOString(),
        isImported: !!dbRow,
        dbId: dbRow?.id ?? null,
        dbStatus: dbRow?.status ?? null,
      }
    })

    return NextResponse.json({
      data: meetingsWithStatus,
      count: meetingsWithStatus.length,
    })
  } catch (error) {
    console.error('Error fetching BoardDocs meetings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meetings' },
      { status: 500 }
    )
  }
}
