import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminUser } from '@/lib/auth/is-admin-server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getBoardDocsUrl, getMeetingAgenda, getMeetingContent, listMeetings } from '@/lib/boarddocs'
import { runSummarize } from '@/lib/run-summarize'
import {
  attachmentIngestionEnabled,
  persistMeetingIngestion,
} from '@/lib/meeting-ingestion'
import { logActivity, ActivityTypes } from '@/lib/activity'
import {
  getSchoolDistrict,
  isSchoolDistrictId,
  shouldImportRegularMeeting,
  type SchoolDistrictId,
} from '@/lib/school-districts'

const boardDocsIdSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/)

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized', message: 'You must be logged in' },
        { status: 401 }
      ),
    }
  }

  if (!await isAdminUser(user)) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return { supabase }
}

function invalidDistrictResponse() {
  return NextResponse.json({ error: 'Invalid district ID' }, { status: 400 })
}

export async function getBoardDocsMeetingsResponse(rawDistrictId: string) {
  if (!isSchoolDistrictId(rawDistrictId)) {
    return invalidDistrictResponse()
  }
  const districtId = rawDistrictId

  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const meetings = await listMeetings(districtId)

    const { data: existingMeetings } = await auth.supabase
      .from('meetings')
      .select('id, source_url, status, district_id')
      .eq('source', 'boarddocs')
      .eq('district_id', districtId) as unknown as {
        data: {
          id: string
          source_url: string
          status: string
          district_id: SchoolDistrictId
        }[] | null
      }

    const importedMap = new Map<string, { id: string; status: string }>(
      existingMeetings?.map((m) => [
        m.source_url,
        { id: m.id, status: m.status },
      ]) || []
    )

    const meetingsWithStatus = meetings.map((meeting) => {
      const sourceUrl = getBoardDocsUrl(meeting.id, districtId)
      const dbRow = importedMap.get(sourceUrl)
      return {
        ...meeting,
        date: meeting.date.toISOString(),
        isImported: !!dbRow,
        dbId: dbRow?.id ?? null,
        dbStatus: dbRow?.status ?? null,
        isRegularMeeting: shouldImportRegularMeeting(districtId, meeting.name),
      }
    })

    const district = getSchoolDistrict(districtId)

    return NextResponse.json({
      data: meetingsWithStatus,
      count: meetingsWithStatus.length,
      importedCount: meetingsWithStatus.filter((m) => m.isImported).length,
      regularMeetingCount: meetingsWithStatus.filter((m) => m.isRegularMeeting).length,
      district: {
        id: district.id,
        label: district.uiLabel,
        schoolSystemLabel: district.schoolSystemLabel,
        boardBodyLabel: district.boardBodyLabel,
        sourceUrl: district.sourceUrl(),
        regularMeetingFilterDescription: district.regularMeetingFilterDescription,
      },
    })
  } catch (error) {
    console.error('Error fetching BoardDocs meetings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meetings' },
      { status: 500 }
    )
  }
}

export async function getBoardDocsAgendaResponse(rawDistrictId: string, id: string) {
  if (!isSchoolDistrictId(rawDistrictId)) {
    return invalidDistrictResponse()
  }

  try {
    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const agendaItems = await getMeetingAgenda(id, rawDistrictId)

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

export async function importBoardDocsMeetingResponse(rawDistrictId: string, id: string) {
  if (!isSchoolDistrictId(rawDistrictId)) {
    return invalidDistrictResponse()
  }
  const districtId = rawDistrictId

  try {
    const idResult = boardDocsIdSchema.safeParse(id)
    if (!idResult.success) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 })
    }

    const auth = await requireAdmin()
    if (auth.error) return auth.error

    const district = getSchoolDistrict(districtId)
    const sourceUrl = getBoardDocsUrl(id, districtId)
    const adminClient = createAdminClient()
    const includeAttachments = attachmentIngestionEnabled()
    const content = await getMeetingContent(id, districtId, { includeAttachments })
    const meetingDate = content.date.toISOString().split('T')[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: insertedRows, error: insertError } = await (adminClient as any)
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
        boarddocs_id: id,
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
        .select('id, title, body, district_id, meeting_date, source_url, status, created_at, updated_at')
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

      await persistMeetingIngestion(adminClient, existingMeeting.id, content)
      if (includeAttachments) {
        await adminClient.from('meetings').update({ transcript_text: content.fullText }).eq('id', existingMeeting.id)
      }

      return NextResponse.json({
        message: 'Meeting already imported',
        data: existingMeeting,
        itemCount: content.itemCount,
        documentCount: content.documentCount,
        autoSummarizeStarted: false,
      }, { status: 200 })
    }

    await persistMeetingIngestion(adminClient, insertedMeeting.id, content)

    logActivity(
      ActivityTypes.MEETING_IMPORTED,
      `Imported ${district.uiLabel} meeting "${content.title}"`,
      { meetingId: insertedMeeting.id, districtId, boarddocsId: id, itemCount: content.itemCount }
    ).catch(() => {})

    runSummarize(insertedMeeting.id, content.fullText, content.title, adminClient).catch((err) => {
      console.error('Auto-summarization failed for meeting', insertedMeeting.id, err)
    })

    return NextResponse.json({
      message: 'Meeting imported successfully',
      data: insertedMeeting,
      itemCount: content.itemCount,
      documentCount: content.documentCount,
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
