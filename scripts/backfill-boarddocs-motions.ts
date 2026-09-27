import { createAdminClient } from '@/lib/supabase/server'
import { getMeetingContent } from '@/lib/boarddocs'
import {
  SCHOOL_DISTRICT_IDS,
  isSchoolDistrictId,
  type SchoolDistrictId,
} from '@/lib/school-districts'

interface BackfillMeeting {
  id: string
  boarddocs_id: string
  district_id: SchoolDistrictId
  title: string
  meeting_date: string
}

function argument(name: string) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function backfillLimit() {
  const parsed = Number(argument('--limit') ?? 25)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
    throw new Error('--limit must be an integer between 1 and 100')
  }
  return parsed
}

async function main() {
  if (process.argv.includes('--apply')) {
    throw new Error(
      'Apply mode disabled while linked Supabase migration history is divergent. Run with --dry-run only.',
    )
  }

  const rawDistrict = argument('--district')
  if (rawDistrict && !isSchoolDistrictId(rawDistrict)) {
    throw new Error(`--district must be one of: ${SCHOOL_DISTRICT_IDS.join(', ')}`)
  }
  const districtId = rawDistrict as SchoolDistrictId | undefined
  const limit = backfillLimit()
  const supabase = createAdminClient()

  let query = supabase
    .from('meetings')
    // Keep dry-run usable before unreconciled migration is deployed. Existing
    // source hashes cannot be compared until freshness columns exist remotely.
    .select('id, boarddocs_id, district_id, title, meeting_date')
    .eq('source', 'boarddocs')
    .not('boarddocs_id', 'is', null)
    .order('meeting_date', { ascending: false })
    .limit(limit)
  if (districtId) query = query.eq('district_id', districtId)

  const { data, error } = await query
  if (error) throw error

  const meetings = (data ?? []) as BackfillMeeting[]
  let changed = 0
  const unchanged = 0
  let awaitingResults = 0
  let rejected = 0

  for (const meeting of meetings) {
    try {
      const content = await getMeetingContent(meeting.boarddocs_id, meeting.district_id, {
        includeAttachments: false,
      })
      const motionCount = content.agendaItems.reduce(
        (count, item) => count + item.content.motions.length,
        0,
      )
      const status = !content.complete
        ? 'partial_rejected'
        : !content.hasOfficialResults
          ? 'awaiting_results'
          : 'would_refresh'

      if (status === 'partial_rejected') rejected++
      else if (status === 'awaiting_results') awaitingResults++
      else changed++

      console.log(
        JSON.stringify({
          meetingId: meeting.id,
          boardDocsId: meeting.boarddocs_id,
          districtId: meeting.district_id,
          meetingDate: meeting.meeting_date,
          status,
          motionCount,
          fetchedAgendaItems: content.itemCount,
          expectedAgendaItems: content.expectedItemCount,
          storedHash: null,
          storedHashAvailable: false,
          fetchedHash: content.contentHash,
        }),
      )
    } catch (error) {
      rejected++
      console.log(
        JSON.stringify({
          meetingId: meeting.id,
          boardDocsId: meeting.boarddocs_id,
          districtId: meeting.district_id,
          status: 'fetch_failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      )
    }
  }

  console.log(
    JSON.stringify({
      dryRun: true,
      scanned: meetings.length,
      wouldRefresh: changed,
      unchanged,
      awaitingResults,
      rejected,
    }),
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
