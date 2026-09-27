import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isAdminUser } from '@/lib/auth/is-admin-server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getBoardDocsUrl, getMeetingAgenda, listMeetings } from '@/lib/boarddocs'
import { refreshBoardDocsMeeting } from '@/lib/boarddocs-refresh'
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

    const { data: existingMeetings, error: existingMeetingsError } = await auth.supabase
      .from('meetings')
      .select(`
        id,
        source_url,
        status,
        district_id,
        boarddocs_last_checked_at,
        boarddocs_results_seen_at,
        boarddocs_refresh_error,
        boarddocs_refresh_started_at
      `)
      .eq('source', 'boarddocs')
      .eq('district_id', districtId) as unknown as {
        data: {
          id: string
          source_url: string
          status: string
          district_id: SchoolDistrictId
          boarddocs_last_checked_at: string | null
          boarddocs_results_seen_at: string | null
          boarddocs_refresh_error: string | null
          boarddocs_refresh_started_at: string | null
        }[] | null
        error: Error | null
      }
    if (existingMeetingsError) throw existingMeetingsError

    const importedMap = new Map<string, {
      id: string
      status: string
      lastCheckedAt: string | null
      resultsSeenAt: string | null
      refreshError: string | null
      refreshStartedAt: string | null
    }>(
      existingMeetings?.map((m) => [
        m.source_url,
        {
          id: m.id,
          status: m.status,
          lastCheckedAt: m.boarddocs_last_checked_at,
          resultsSeenAt: m.boarddocs_results_seen_at,
          refreshError: m.boarddocs_refresh_error,
          refreshStartedAt: m.boarddocs_refresh_started_at,
        },
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
        boarddocsLastCheckedAt: dbRow?.lastCheckedAt ?? null,
        boarddocsResultsSeenAt: dbRow?.resultsSeenAt ?? null,
        boarddocsRefreshError: dbRow?.refreshError ?? null,
        boarddocsRefreshStartedAt: dbRow?.refreshStartedAt ?? null,
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
    const adminClient = createAdminClient()
    const meetings = await listMeetings(districtId)
    const meeting = meetings.find((candidate) => candidate.id === id)
    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found in BoardDocs' }, { status: 404 })
    }

    const result = await refreshBoardDocsMeeting(adminClient, districtId, meeting)
    const { data: savedMeeting, error: savedMeetingError } = await adminClient
      .from('meetings')
      .select('id, status, boarddocs_last_checked_at, boarddocs_results_seen_at, boarddocs_refresh_error')
      .eq('id', result.meetingId)
      .single()
    if (savedMeetingError) throw savedMeetingError

    logActivity(
      ActivityTypes.MEETING_IMPORTED,
      `BoardDocs ${result.status} for ${district.uiLabel} meeting "${meeting.name}"`,
      {
        meetingId: result.meetingId,
        districtId,
        boarddocsId: id,
        itemCount: result.itemCount,
        refreshStatus: result.status,
      }
    ).catch(() => {})

    return NextResponse.json({
      message: result.status === 'refreshed'
        ? 'Meeting refreshed from BoardDocs'
        : result.status === 'unchanged'
          ? 'BoardDocs content unchanged'
          : result.status === 'awaiting_results'
            ? 'Meeting saved; awaiting official BoardDocs results'
            : 'BoardDocs refresh failed; previous complete version preserved',
      refreshStatus: result.status,
      data: savedMeeting,
      itemCount: result.itemCount,
      documentCount: result.documentCount,
      summaryRevision: result.summaryRevision,
      error: result.error,
    }, { status: 200 })
  } catch (error) {
    console.error('Error importing meeting:', error)
    return NextResponse.json(
      { error: 'Import failed' },
      { status: 500 }
    )
  }
}
