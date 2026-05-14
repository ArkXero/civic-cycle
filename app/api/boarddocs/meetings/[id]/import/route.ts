import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/get-current-user'
import { createAdminClient } from '@/lib/supabase/server'
import { getMeetingContent, getBoardDocsUrl } from '@/lib/boarddocs'
import { runSummarize } from '@/lib/run-summarize'
import { logActivity, ActivityTypes } from '@/lib/activity'
import { z } from 'zod'

const boardDocsIdSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/)

// POST /api/boarddocs/meetings/[id]/import - Import a BoardDocs meeting
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const idResult = boardDocsIdSchema.safeParse(id)
    if (!idResult.success) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 })
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!currentUser.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const sourceUrl = getBoardDocsUrl(id)

    const adminClient = createAdminClient()

    // Fetch full meeting content from BoardDocs
    const content = await getMeetingContent(id)

    const meetingDate = content.date.toISOString().split('T')[0]

    // Insert only if the source URL is new. Existing imports are returned below
    // without touching status/updated_at, so stuck-processing recovery is not delayed.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: insertedRows, error: insertError } = await (adminClient as any)
      .from('meetings')
      .upsert({
        title: content.title,
        body: 'FCPS School Board',
        meeting_date: meetingDate,
        transcript_text: content.fullText,
        source: 'boarddocs',
        source_url: sourceUrl,
        status: 'pending',
      }, { onConflict: 'source,source_url', ignoreDuplicates: true })
      .select()

    if (insertError) {
      console.error('Failed to upsert meeting:', insertError)
      return NextResponse.json(
        { error: 'Failed to save meeting to database' },
        { status: 500 }
      )
    }

    const insertedMeeting = (insertedRows as { id: string }[] | null)?.[0]

    if (!insertedMeeting) {
      const { data: existingMeeting, error: existingError } = await adminClient
        .from('meetings')
        .select('id, title, body, meeting_date, source_url, status, created_at, updated_at')
        .eq('source', 'boarddocs')
        .eq('source_url', sourceUrl)
        .single()

      if (existingError || !existingMeeting) {
        console.error('Failed to fetch existing imported meeting:', existingError)
        return NextResponse.json(
          { error: 'Failed to load existing meeting' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        message: 'Meeting already imported',
        data: existingMeeting,
        itemCount: content.itemCount,
        autoSummarizeStarted: false,
      }, { status: 200 })
    }

    // Log the import activity (fire-and-forget)
    logActivity(
      ActivityTypes.MEETING_IMPORTED,
      `Imported meeting "${content.title}"`,
      { meetingId: insertedMeeting.id, boarddocsId: id, itemCount: content.itemCount }
    ).catch(() => {})

    // Kick off summarization only for newly inserted meetings.
    runSummarize(insertedMeeting.id, content.fullText, content.title, adminClient).catch((err) => {
      console.error('Auto-summarization failed for meeting', insertedMeeting.id, err)
    })

    return NextResponse.json({
      message: 'Meeting imported successfully',
      data: insertedMeeting,
      itemCount: content.itemCount,
      autoSummarizeStarted: true,
    }, { status: 201 })
  } catch (error) {
    console.error('Error importing meeting:', error)
    return NextResponse.json(
      { error: 'Import failed' },
      { status: 500 }
    )
  }
}
