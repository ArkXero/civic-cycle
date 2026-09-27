import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { BoardDocsMeeting, MeetingContentResult } from '@/lib/boarddocs'
import { getBoardDocsUrl, getMeetingContent } from '@/lib/boarddocs'
import { attachmentIngestionEnabled, persistMeetingIngestion } from '@/lib/meeting-ingestion'
import { runSummarize } from '@/lib/run-summarize'
import { dateInSchoolDistrict, getSchoolDistrict, type SchoolDistrictId } from '@/lib/school-districts'

type AdminClient = SupabaseClient<Database>

export type BoardDocsRefreshStatus =
  | 'unchanged'
  | 'awaiting_results'
  | 'refreshed'
  | 'refresh_failed'

export interface BoardDocsRefreshResult {
  status: BoardDocsRefreshStatus
  meetingId: string
  contentHash: string | null
  itemCount: number
  documentCount: number
  summaryRevision?: number
  error?: string
}

interface ExistingBoardDocsMeeting {
  id: string
  status: string
  boarddocs_content_hash: string | null
  boarddocs_results_seen_at: string | null
  summary_source_content_hash: string | null
}

const REFRESH_LEASE_SECONDS = 15 * 60

class RefreshLeaseLostError extends Error {
  constructor() {
    super('BoardDocs refresh lease was lost')
    this.name = 'RefreshLeaseLostError'
  }
}

export function boardDocsResultsGraceDays() {
  const parsed = Number(process.env.BOARDDOCS_RESULTS_GRACE_DAYS ?? 21)
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 90) return 21
  return parsed
}

export function boardDocsDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function subtractCalendarDays(date: string, days: number) {
  const result = new Date(`${date}T12:00:00.000Z`)
  result.setUTCDate(result.getUTCDate() - days)
  return result.toISOString().slice(0, 10)
}

export function isFutureBoardDocsMeeting(
  date: Date,
  timeZone: string,
  now = new Date()
) {
  return boardDocsDate(date) > dateInSchoolDistrict(timeZone, now)
}

export function shouldPollBoardDocsResults(date: Date, timeZone: string, now = new Date()) {
  if (isFutureBoardDocsMeeting(date, timeZone, now)) return false
  const graceStart = subtractCalendarDays(
    dateInSchoolDistrict(timeZone, now),
    boardDocsResultsGraceDays()
  )
  return boardDocsDate(date) >= graceStart
}

function flattenedOfficialMotions(content: MeetingContentResult) {
  return content.agendaItems.flatMap((item) => item.content.motions)
}

async function ensureMeetingRow(
  adminClient: AdminClient,
  districtId: SchoolDistrictId,
  meeting: BoardDocsMeeting
): Promise<ExistingBoardDocsMeeting> {
  const district = getSchoolDistrict(districtId)
  const sourceUrl = getBoardDocsUrl(meeting.id, districtId)

  const { error: upsertError } = await adminClient
    .from('meetings')
    .upsert({
      title: meeting.name,
      body: district.boardBodyLabel,
      district_id: districtId,
      meeting_date: boardDocsDate(meeting.date),
      transcript_source: 'boarddocs',
      source: 'boarddocs',
      source_url: sourceUrl,
      boarddocs_id: meeting.id,
      status: 'pending',
    }, { onConflict: 'source,source_url', ignoreDuplicates: true })
  if (upsertError) throw upsertError

  const { data, error } = await adminClient
    .from('meetings')
    .select('id, status, boarddocs_content_hash, boarddocs_results_seen_at, summaries(source_content_hash)')
    .eq('source', 'boarddocs')
    .eq('source_url', sourceUrl)
    .single()
  if (error || !data) throw error ?? new Error('BoardDocs meeting row was not created')
  const relatedSummaries = (data as unknown as {
    summaries: { source_content_hash: string | null }[] | null
  }).summaries
  return {
    id: data.id,
    status: data.status,
    boarddocs_content_hash: data.boarddocs_content_hash,
    boarddocs_results_seen_at: data.boarddocs_results_seen_at,
    summary_source_content_hash: relatedSummaries?.[0]?.source_content_hash ?? null,
  }
}

async function releaseRefresh(
  adminClient: AdminClient,
  meetingId: string,
  token: string,
  values: { error?: string | null; checkedAt?: string; resultsSeenAt?: string }
) {
  const update: Database['public']['Tables']['meetings']['Update'] = {
    boarddocs_refresh_token: null,
    boarddocs_refresh_started_at: null,
  }
  if ('error' in values) update.boarddocs_refresh_error = values.error ?? null
  if (values.checkedAt) update.boarddocs_last_checked_at = values.checkedAt
  if (values.resultsSeenAt) update.boarddocs_results_seen_at = values.resultsSeenAt

  const { data, error } = await adminClient
    .from('meetings')
    .update(update)
    .eq('id', meetingId)
    .eq('boarddocs_refresh_token', token)
    .select('id')
    .maybeSingle()
  if (error) throw error
  if (!data) throw new RefreshLeaseLostError()
}

export async function refreshBoardDocsMeeting(
  adminClient: AdminClient,
  districtId: SchoolDistrictId,
  meeting: BoardDocsMeeting,
  options: { includeAttachments?: boolean; now?: Date } = {}
): Promise<BoardDocsRefreshResult> {
  const existing = await ensureMeetingRow(adminClient, districtId, meeting)
  const { data: token, error: lockError } = await adminClient.rpc('try_begin_boarddocs_refresh', {
    target_meeting_id: existing.id,
    lease_seconds: REFRESH_LEASE_SECONDS,
  })
  if (lockError) throw lockError
  if (!token) {
    return {
      status: 'refresh_failed',
      meetingId: existing.id,
      contentHash: existing.boarddocs_content_hash,
      itemCount: 0,
      documentCount: 0,
      error: 'Refresh already in progress',
    }
  }

  const now = options.now ?? new Date()
  const checkedAt = now.toISOString()
  const timeZone = getSchoolDistrict(districtId).timeZone

  try {
    const content = await getMeetingContent(meeting.id, districtId, {
      includeAttachments: options.includeAttachments ?? attachmentIngestionEnabled(),
    })
    const lostPreviouslySeenResults = Boolean(
      existing.boarddocs_results_seen_at && !content.hasOfficialResults
    )

    const emptyAgendaWouldReplaceExisting = content.expectedItemCount === 0
    if (!content.complete || lostPreviouslySeenResults || emptyAgendaWouldReplaceExisting) {
      const detail = !content.complete
        ? `Partial BoardDocs fetch: ${content.itemCount}/${content.expectedItemCount} agenda items (${content.fetchErrors.join('; ')})`
        : lostPreviouslySeenResults
          ? 'BoardDocs response omitted previously observed official results'
          : 'BoardDocs response omitted the existing agenda'
      await releaseRefresh(adminClient, existing.id, token, { error: detail, checkedAt })
      return {
        status: 'refresh_failed',
        meetingId: existing.id,
        contentHash: existing.boarddocs_content_hash,
        itemCount: content.itemCount,
        documentCount: content.documentCount,
        error: detail,
      }
    }

    const isFuture = isFutureBoardDocsMeeting(content.date, timeZone, now)
    const sourceUnchanged = existing.boarddocs_content_hash === content.contentHash
    const summaryIsFresh = existing.summary_source_content_hash === content.contentHash
    const firstResultsSeenAt = content.hasOfficialResults && !existing.boarddocs_results_seen_at
      ? checkedAt
      : undefined

    if (sourceUnchanged) {
      if (isFuture || !content.hasOfficialResults) {
        await releaseRefresh(adminClient, existing.id, token, { error: null, checkedAt })
        return {
          status: 'awaiting_results',
          meetingId: existing.id,
          contentHash: content.contentHash,
          itemCount: content.itemCount,
          documentCount: content.documentCount,
        }
      }

      if (summaryIsFresh) {
        await releaseRefresh(adminClient, existing.id, token, {
          error: null,
          checkedAt,
          resultsSeenAt: firstResultsSeenAt,
        })
        return {
          status: 'unchanged',
          meetingId: existing.id,
          contentHash: content.contentHash,
          itemCount: content.itemCount,
          documentCount: content.documentCount,
        }
      }

      try {
        const summary = await runSummarize(
          existing.id,
          content.fullText,
          content.title,
          adminClient,
          {
            sourceContentHash: content.contentHash,
            officialMotions: flattenedOfficialMotions(content),
            refreshToken: token,
            expectedBoardDocsContentHash: content.contentHash,
          }
        )
        await releaseRefresh(adminClient, existing.id, token, {
          error: null,
          checkedAt,
          resultsSeenAt: firstResultsSeenAt,
        })
        return {
          status: 'refreshed',
          meetingId: existing.id,
          contentHash: content.contentHash,
          itemCount: content.itemCount,
          documentCount: content.documentCount,
          summaryRevision: summary.revision,
        }
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Summary refresh failed'
        await releaseRefresh(adminClient, existing.id, token, {
          error: detail,
          checkedAt,
          resultsSeenAt: firstResultsSeenAt,
        })
        return {
          status: 'refresh_failed',
          meetingId: existing.id,
          contentHash: content.contentHash,
          itemCount: content.itemCount,
          documentCount: content.documentCount,
          error: detail,
        }
      }
    }

    await persistMeetingIngestion(adminClient, existing.id, token, content, {
      meetingDate: boardDocsDate(content.date),
      transcript: isFuture ? null : content.fullText,
      checkedAt,
      resultsSeenAt: firstResultsSeenAt ?? null,
    })

    if (isFuture || !content.hasOfficialResults) {
      await releaseRefresh(adminClient, existing.id, token, { error: null, checkedAt })
      return {
        status: 'awaiting_results',
        meetingId: existing.id,
        contentHash: content.contentHash,
        itemCount: content.itemCount,
        documentCount: content.documentCount,
      }
    }

    try {
      const summary = await runSummarize(
        existing.id,
        content.fullText,
        content.title,
        adminClient,
          {
            sourceContentHash: content.contentHash,
            officialMotions: flattenedOfficialMotions(content),
            refreshToken: token,
            expectedBoardDocsContentHash: content.contentHash,
          }
      )
      await releaseRefresh(adminClient, existing.id, token, { error: null, checkedAt })
      return {
        status: 'refreshed',
        meetingId: existing.id,
        contentHash: content.contentHash,
        itemCount: content.itemCount,
        documentCount: content.documentCount,
        summaryRevision: summary.revision,
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Summary refresh failed'
      await releaseRefresh(adminClient, existing.id, token, { error: detail, checkedAt })
      return {
        status: 'refresh_failed',
        meetingId: existing.id,
        contentHash: content.contentHash,
        itemCount: content.itemCount,
        documentCount: content.documentCount,
        error: detail,
      }
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'BoardDocs refresh failed'
    if (!(error instanceof RefreshLeaseLostError)) {
      try {
        await releaseRefresh(adminClient, existing.id, token, { error: detail, checkedAt })
      } catch (releaseError) {
        const releaseDetail = releaseError instanceof Error
          ? releaseError.message
          : 'Failed to release BoardDocs refresh lease'
        return {
          status: 'refresh_failed',
          meetingId: existing.id,
          contentHash: existing.boarddocs_content_hash,
          itemCount: 0,
          documentCount: 0,
          error: `${detail}; ${releaseDetail}`,
        }
      }
    }
    return {
      status: 'refresh_failed',
      meetingId: existing.id,
      contentHash: existing.boarddocs_content_hash,
      itemCount: 0,
      documentCount: 0,
      error: detail,
    }
  }
}
