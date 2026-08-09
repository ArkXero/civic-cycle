import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { listMeetings, getMeetingContent, getBoardDocsUrl } from '@/lib/boarddocs'
import { runSummarize } from '@/lib/run-summarize'
import {
  attachmentIngestionEnabled,
  persistMeetingIngestion,
} from '@/lib/meeting-ingestion'
import { logActivity, ActivityTypes } from '@/lib/activity'
import {
  SCHOOL_DISTRICT_IDS,
  getSchoolDistrict,
  isSchoolDistrictId,
  shouldImportRegularMeeting,
  type SchoolDistrictId,
} from '@/lib/school-districts'

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rawDistrictId = request.nextUrl.searchParams.get('districtId')
  if (rawDistrictId && !isSchoolDistrictId(rawDistrictId)) {
    return NextResponse.json({ error: 'Invalid district ID' }, { status: 400 })
  }
  const districtId = rawDistrictId && isSchoolDistrictId(rawDistrictId) ? rawDistrictId : null

  runImport(districtId).catch((err) => {
    console.error('Unexpected error in background import:', err)
  })

  return NextResponse.json({
    ok: true,
    status: 'started',
    districtId: districtId ?? 'all',
  }, { status: 202 })
}

async function runImport(targetDistrictId: SchoolDistrictId | null) {
  const adminClient = createAdminClient()
  const districtIds = targetDistrictId ? [targetDistrictId] : [...SCHOOL_DISTRICT_IDS]

  const sixtyDaysAgo = new Date()
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

  for (const districtId of districtIds) {
    const district = getSchoolDistrict(districtId)
    let boardDocsMeetings

    try {
      boardDocsMeetings = await listMeetings(districtId)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      console.error(`Failed to fetch BoardDocs meeting list for ${districtId}:`, detail)
      continue
    }

    const recentMeetings = boardDocsMeetings.filter((m) => m.date >= sixtyDaysAgo)
    const regularMeetings = recentMeetings.filter((m) =>
      shouldImportRegularMeeting(districtId, m.name)
    )

    const { data: existingMeetings, error: existingMeetingsError } = await adminClient
      .from('meetings')
      .select('id, source_url, status')
      .eq('source', 'boarddocs')
      .eq('district_id', districtId)
    if (existingMeetingsError) {
      console.error(`Failed to load existing meetings for ${districtId}:`, existingMeetingsError)
      continue
    }
    const existingBySourceUrl = new Map(
      (existingMeetings ?? []).map((existing) => [existing.source_url, existing])
    )

    let imported = 0
    let retriedIncomplete = 0
    let skippedDuplicates = 0
    const skippedOld = boardDocsMeetings.length - recentMeetings.length
    const skippedNonRegular = recentMeetings.length - regularMeetings.length

    for (const meeting of regularMeetings) {
      try {
        const sourceUrl = getBoardDocsUrl(meeting.id, districtId)
        const knownMeeting = existingBySourceUrl.get(sourceUrl)
        if (knownMeeting && knownMeeting.status !== 'pending' && knownMeeting.status !== 'failed') {
          skippedDuplicates++
          continue
        }

        const content = await getMeetingContent(meeting.id, districtId, {
          includeAttachments: attachmentIngestionEnabled(),
        })
        const meetingDate = content.date.toISOString().split('T')[0]

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: inserted, error: insertError } = await (adminClient as any)
          .from('meetings')
          .upsert({
            title: content.title,
            body: district.boardBodyLabel,
            district_id: districtId,
            meeting_date: meetingDate,
            transcript_text: content.fullText,
            transcript_source: 'boarddocs',
            source: 'boarddocs',
            source_url: sourceUrl,
            boarddocs_id: meeting.id,
            status: 'pending',
          }, { onConflict: 'source,source_url', ignoreDuplicates: true })
          .select()
        const insertedRows = inserted as { id: string }[] | null

        if (insertError) {
          console.error(`Failed to upsert ${districtId} meeting "${content.title}":`, insertError)
          continue
        }

        let targetMeeting = insertedRows?.[0] as { id: string; status?: string } | undefined
        let isRetry = false

        if (!targetMeeting) {
          let existingMeeting = knownMeeting
          let existingError = null
          if (!existingMeeting) {
            const lookup = await adminClient
              .from('meetings')
              .select('id, source_url, status')
              .eq('source', 'boarddocs')
              .eq('source_url', sourceUrl)
              .single()
            existingMeeting = lookup.data ?? undefined
            existingError = lookup.error
          }

          if (existingError || !existingMeeting) {
            console.error(`Failed to load existing ${districtId} meeting "${content.title}":`, existingError)
            continue
          }
          if (existingMeeting.status !== 'pending' && existingMeeting.status !== 'failed') {
            skippedDuplicates++
            continue
          }

          targetMeeting = existingMeeting
          isRetry = true
        }

        try {
          await persistMeetingIngestion(adminClient, targetMeeting.id, content)
        } catch (ingestionError) {
          const detail = ingestionError instanceof Error ? ingestionError.message : String(ingestionError)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (adminClient.from('meetings') as any)
            .update({ status: 'failed', error_message: `Agenda ingestion failed: ${detail}` })
            .eq('id', targetMeeting.id)
          throw ingestionError
        }

        runSummarize(targetMeeting.id, content.fullText, content.title, adminClient).catch((err) => {
          console.error('Auto-summarization failed for meeting', targetMeeting.id, err)
        })

        logActivity(
          ActivityTypes.MEETING_IMPORTED,
          `Auto-imported ${district.uiLabel} meeting "${content.title}"`,
          { meetingId: targetMeeting.id, districtId, boarddocsId: meeting.id, itemCount: content.itemCount, isRetry }
        ).catch(() => {})

        if (isRetry) retriedIncomplete++
        else imported++
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        console.error(`Failed to import ${districtId} meeting "${meeting.name}":`, msg)
      }
    }

    console.log(
      `Import complete for ${districtId}: ${imported} imported, ${retriedIncomplete} incomplete retried, ` +
      `${skippedDuplicates} duplicates skipped, ${skippedNonRegular} non-regular skipped, ` +
      `${skippedOld} old skipped, ${boardDocsMeetings.length} total`
    )
  }

  const ninetyDaysAgo = new Date()
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const cutoff = ninetyDaysAgo.toISOString().split('T')[0]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let staleQuery = (adminClient.from('meetings') as any)
    .select('id')
    .eq('source', 'boarddocs')
    .lt('meeting_date', cutoff)

  if (targetDistrictId) {
    staleQuery = staleQuery.eq('district_id', targetDistrictId)
  }

  const { data: staleRows } = await staleQuery as { data: { id: string }[] | null }

  if (staleRows && staleRows.length > 0) {
    const staleIds = staleRows.map((r: { id: string }) => r.id)

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
