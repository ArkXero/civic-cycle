import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { listMeetings } from '@/lib/boarddocs'
import {
  refreshBoardDocsMeeting,
  boardDocsResultsGraceDays,
  isFutureBoardDocsMeeting,
  shouldPollBoardDocsResults,
} from '@/lib/boarddocs-refresh'
import { logActivity, ActivityTypes } from '@/lib/activity'
import {
  SCHOOL_DISTRICT_IDS,
  dateInSchoolDistrict,
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

export async function runImport(targetDistrictId: SchoolDistrictId | null) {
  const adminClient = createAdminClient()
  const districtIds = targetDistrictId ? [targetDistrictId] : [...SCHOOL_DISTRICT_IDS]

  const lookbackDays = Math.max(60, boardDocsResultsGraceDays())

  for (const districtId of districtIds) {
    const district = getSchoolDistrict(districtId)
    const oldestEligibleMeeting = new Date(`${dateInSchoolDistrict(district.timeZone)}T00:00:00`)
    oldestEligibleMeeting.setDate(oldestEligibleMeeting.getDate() - lookbackDays)
    let boardDocsMeetings

    try {
      boardDocsMeetings = await listMeetings(districtId)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      console.error(`Failed to fetch BoardDocs meeting list for ${districtId}:`, detail)
      continue
    }

    const recentMeetings = boardDocsMeetings.filter((m) => m.date >= oldestEligibleMeeting)
    const regularMeetings = recentMeetings.filter((m) =>
      shouldImportRegularMeeting(districtId, m.name)
    )

    let refreshed = 0
    let unchanged = 0
    let awaitingResults = 0
    let refreshFailed = 0
    let skippedOutsideGrace = 0
    const skippedOld = boardDocsMeetings.length - recentMeetings.length
    const skippedNonRegular = recentMeetings.length - regularMeetings.length

    for (const meeting of regularMeetings) {
      try {
        if (
          !isFutureBoardDocsMeeting(meeting.date, district.timeZone) &&
          !shouldPollBoardDocsResults(meeting.date, district.timeZone)
        ) {
          skippedOutsideGrace++
          continue
        }

        const result = await refreshBoardDocsMeeting(adminClient, districtId, meeting)
        if (result.status === 'refreshed') refreshed++
        else if (result.status === 'unchanged') unchanged++
        else if (result.status === 'awaiting_results') awaitingResults++
        else refreshFailed++

        logActivity(
          ActivityTypes.MEETING_IMPORTED,
          `BoardDocs ${result.status} for ${district.uiLabel} meeting "${meeting.name}"`,
          {
            meetingId: result.meetingId,
            districtId,
            boarddocsId: meeting.id,
            itemCount: result.itemCount,
            refreshStatus: result.status,
          }
        ).catch(() => {})
      } catch (err) {
        refreshFailed++
        const msg = err instanceof Error ? err.message : 'Unknown error'
        console.error(`Failed to import ${districtId} meeting "${meeting.name}":`, msg)
      }
    }

    console.log(
      `Import complete for ${districtId}: ${refreshed} refreshed, ${unchanged} unchanged, ` +
      `${awaitingResults} awaiting results, ${refreshFailed} failed, ${skippedOutsideGrace} outside grace, ` +
      `${skippedNonRegular} non-regular skipped, ` +
      `${skippedOld} old skipped, ${boardDocsMeetings.length} total`
    )
  }
}
