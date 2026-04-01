import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listMeetings, getBoardDocsUrl } from '@/lib/boarddocs'
import { isAdminEmail } from '@/lib/is-admin'

// GET /api/boarddocs/meetings - List all BoardDocs meetings with import status
export async function GET() {
  try {
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in' },
        { status: 401 }
      )
    }

    if (!isAdminEmail(user.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const meetings = await listMeetings()

    // Fetch all already-imported BoardDocs meetings from the DB in one small query.
    // Using .in() with thousands of URLs silently fails in Supabase — cross-reference locally instead.
    // SSR client infers never for meetings table — adminClient avoids the cast.
    const { data: existingMeetings } = await supabase
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
