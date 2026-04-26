import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { listMeetings, getMeetingContent, getBoardDocsUrl } from '@/lib/boarddocs'
import { runSummarize } from '@/lib/run-summarize'
import { logActivity, ActivityTypes } from '@/lib/activity'

export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get('authorization')

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Fetch all BoardDocs meetings
    let boardDocsMeetings
    try {
      boardDocsMeetings = await listMeetings()
    } catch (err) {
      console.error('Failed to fetch BoardDocs meeting list:', err)
      return NextResponse.json({ error: 'Failed to fetch BoardDocs meetings' }, { status: 500 })
    }

    // Batch-fetch already-imported source_urls
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existingRows, error: dbError } = await (adminClient.from('meetings') as any)
      .select('source_url')
      .eq('source', 'boarddocs') as { data: { source_url: string }[] | null; error: Error | null }

    if (dbError) {
      console.error('Failed to query existing meetings:', dbError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    const importedUrls = new Set((existingRows ?? []).map((r) => r.source_url))

    // Find new meetings not yet in DB
    const newMeetings = boardDocsMeetings.filter((m) => {
      const url = getBoardDocsUrl(m.id)
      return !importedUrls.has(url)
    })

    let imported = 0
    const skipped = boardDocsMeetings.length - newMeetings.length
    const errors: string[] = []

    for (const meeting of newMeetings) {
      try {
        const content = await getMeetingContent(meeting.id)
        const sourceUrl = getBoardDocsUrl(meeting.id)
        const meetingDate = content.date.toISOString().split('T')[0]

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: inserted, error: insertError } = await (adminClient as any)
          .from('meetings')
          .insert({
            title: content.title,
            body: 'FCPS School Board',
            meeting_date: meetingDate,
            transcript_text: content.fullText,
            source: 'boarddocs',
            source_url: sourceUrl,
            status: 'pending',
          })
          .select()
          .single()

        if (insertError) {
          console.error(`Failed to insert meeting "${content.title}":`, insertError)
          errors.push(`Insert failed for "${content.title}": ${insertError.message}`)
          continue
        }

        // Fire-and-forget summarization
        runSummarize(inserted.id, content.fullText, content.title, adminClient).catch((err) => {
          console.error('Auto-summarization failed for meeting', inserted.id, err)
        })

        // Fire-and-forget activity log
        logActivity(
          ActivityTypes.MEETING_IMPORTED,
          `Auto-imported meeting "${content.title}"`,
          { meetingId: inserted.id, boarddocsId: meeting.id, itemCount: content.itemCount }
        ).catch(() => {})

        imported++
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        console.error(`Failed to import meeting "${meeting.name}":`, err)
        errors.push(`Import failed for "${meeting.name}": ${msg}`)
      }
    }

    return NextResponse.json({
      imported,
      skipped,
      total: boardDocsMeetings.length,
      ...(errors.length > 0 ? { errors } : {}),
    })
  } catch (error) {
    console.error('Unexpected error in import-meetings cron:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
