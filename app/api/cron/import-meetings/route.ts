import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { listMeetings, getMeetingContent, getBoardDocsUrl } from '@/lib/boarddocs'
import { runSummarize } from '@/lib/run-summarize'
import { logActivity, ActivityTypes } from '@/lib/activity'

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Return 202 immediately — Cloudflare times out at 100s and the full import
  // takes much longer. Safe to fire-and-forget in self-hosted Docker (persistent
  // Node.js process; request handler returning does not kill async work).
  runImport().catch((err) => {
    console.error('Unexpected error in background import:', err)
  })

  return NextResponse.json({ ok: true, status: 'started' }, { status: 202 })
}

async function runImport() {
  const adminClient = createAdminClient()

  let boardDocsMeetings
  try {
    boardDocsMeetings = await listMeetings()
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('Failed to fetch BoardDocs meeting list:', detail)
    return
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingRows, error: dbError } = await (adminClient.from('meetings') as any)
    .select('source_url')
    .eq('source', 'boarddocs') as { data: { source_url: string }[] | null; error: Error | null }

  if (dbError) {
    console.error('Failed to query existing meetings:', dbError)
    return
  }

  const importedUrls = new Set((existingRows ?? []).map((r) => r.source_url))

  const newMeetings = boardDocsMeetings.filter((m) => !importedUrls.has(getBoardDocsUrl(m.id)))

  let imported = 0
  const skipped = boardDocsMeetings.length - newMeetings.length

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
        continue
      }

      runSummarize(inserted.id, content.fullText, content.title, adminClient).catch((err) => {
        console.error('Auto-summarization failed for meeting', inserted.id, err)
      })

      logActivity(
        ActivityTypes.MEETING_IMPORTED,
        `Auto-imported meeting "${content.title}"`,
        { meetingId: inserted.id, boarddocsId: meeting.id, itemCount: content.itemCount }
      ).catch(() => {})

      imported++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error(`Failed to import meeting "${meeting.name}":`, msg)
    }
  }

  console.log(`Import complete: ${imported} imported, ${skipped} skipped, ${boardDocsMeetings.length} total`)
}
