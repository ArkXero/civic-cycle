import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listMeetings, getBoardDocsUrl } from '@/lib/boarddocs'

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

    const meetings = await listMeetings()

    // Check which meetings are already imported, and get their DB id + status
    const sourceUrls = meetings.map((m) => getBoardDocsUrl(m.id))

    // `as any` still needed: `supabase` uses @supabase/ssr which doesn't fully
    // propagate the Database generic. Use adminClient to avoid this if RLS allows.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingMeetings } = await (supabase
      .from('meetings') as any)
      .select('id, source_url, status')
      .in('source_url', sourceUrls)

    const importedMap = new Map<string, { id: string; status: string }>(
      existingMeetings?.map((m: { id: string; source_url: string; status: string }) => [
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
      { error: 'Failed to fetch meetings', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
