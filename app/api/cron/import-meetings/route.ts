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

  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  const recentMeetings = boardDocsMeetings.filter((m) => m.date >= sixtyDaysAgo)

  let imported = 0
  let skippedDuplicates = 0
  const skippedOld = boardDocsMeetings.length - recentMeetings.length

  for (const meeting of recentMeetings) {
    try {
      const content = await getMeetingContent(meeting.id)
      const sourceUrl = getBoardDocsUrl(meeting.id)
      const meetingDate = content.date.toISOString().split('T')[0]

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: inserted, error: insertError } = await (adminClient as any)
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
      const insertedRows = inserted as { id: string }[] | null

      if (insertError) {
        console.error(`Failed to upsert meeting "${content.title}":`, insertError)
        continue
      }

      if (!insertedRows || insertedRows.length === 0) {
        skippedDuplicates++
        continue
      }

      const insertedMeeting = insertedRows[0]

      runSummarize(insertedMeeting.id, content.fullText, content.title, adminClient).catch((err) => {
        console.error('Auto-summarization failed for meeting', insertedMeeting.id, err)
      })

      logActivity(
        ActivityTypes.MEETING_IMPORTED,
        `Auto-imported meeting "${content.title}"`,
        { meetingId: insertedMeeting.id, boarddocsId: meeting.id, itemCount: content.itemCount }
      ).catch(() => {})

      imported++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      console.error(`Failed to import meeting "${meeting.name}":`, msg)
    }
  }

  console.log(
    `Import complete: ${imported} imported, ${skippedDuplicates} duplicates skipped, ` +
    `${skippedOld} old skipped, ${boardDocsMeetings.length} total`
  )

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const cutoff = ninetyDaysAgo.toISOString().split('T')[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: staleRows } = await (adminClient.from('meetings') as any)
    .select('id')
    .eq('source', 'boarddocs')
    .lt('meeting_date', cutoff) as { data: { id: string }[] | null }

  if (staleRows && staleRows.length > 0) {
    const staleIds = staleRows.map((r: { id: string }) => r.id)

    // Delete summaries first — no CASCADE constraint on summaries.meeting_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient.from('summaries') as any)
      .delete()
      .in('meeting_id', staleIds)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient.from('meetings') as any)
      .delete()
      .in('id', staleIds)

    console.log(`Cleanup: deleted ${staleIds.length} stale meetings older than 90 days`)
  }
}
