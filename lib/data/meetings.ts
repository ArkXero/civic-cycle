import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { MeetingWithSummary } from '@/types'
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '@/lib/constants'

type DBClient = SupabaseClient<Database>

// List queries omit transcript_text to keep payloads small.
const MEETING_LIST_SELECT = `
  id,
  title,
  body,
  meeting_date,
  source,
  source_url,
  status,
  created_at,
  updated_at,
  summary:summaries(
    id,
    meeting_id,
    summary_text,
    key_decisions,
    action_items,
    topics,
    published,
    created_at
  )
` as const

function flattenSummary(row: Record<string, unknown>): MeetingWithSummary {
  const summaryArr = row.summary as unknown[]
  return { ...row, summary: summaryArr?.[0] ?? null } as MeetingWithSummary
}

export function dedupeMeetingsBySourceUrl<T extends { source?: string | null; source_url?: string | null }>(
  meetings: T[]
): T[] {
  const seen = new Set<string>()

  return meetings.filter((meeting) => {
    if (!meeting.source_url) return true

    const key = `${meeting.source ?? ''}|${meeting.source_url}`
    if (seen.has(key)) return false

    seen.add(key)
    return true
  })
}

export interface MeetingListOptions {
  page?: number
  pageSize?: number
  body?: string
  statusFilter?: string | string[]
}

export interface MeetingListResult {
  meetings: MeetingWithSummary[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

export async function getMeetingList(
  supabase: DBClient,
  options: MeetingListOptions = {}
): Promise<MeetingListResult> {
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('meetings')
    .select(MEETING_LIST_SELECT, { count: 'exact' })
    .order('meeting_date', { ascending: false })

  if (options.body) {
    query = query.eq('body', options.body)
  }
  if (options.statusFilter) {
    if (Array.isArray(options.statusFilter)) {
      query = query.in('status', options.statusFilter)
    } else {
      query = query.eq('status', options.statusFilter)
    }
  }

  const from = (page - 1) * pageSize
  query = query.range(from, from + pageSize - 1)

  const { data, error, count } = await query
  if (error) throw error

  return {
    meetings: dedupeMeetingsBySourceUrl(data ?? [])
      .map((row: Record<string, unknown>) => flattenSummary(row)),
    count: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  }
}

export interface SearchOptions {
  query: string
  page?: number
  pageSize?: number
  body?: string
}

export async function searchMeetings(
  supabase: DBClient,
  options: SearchOptions
): Promise<MeetingListResult> {
  const page = Math.max(1, options.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE))
  const from = (page - 1) * pageSize

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // FTS on summaries and meetings in parallel — returns only IDs (tiny payloads)
  const [summaryHits, meetingHits] = await Promise.all([
    db.from('summaries')
      .select('meeting_id')
      .textSearch('search_vector', options.query, { type: 'plain', config: 'english' })
      .limit(500),
    db.from('meetings')
      .select('id')
      .eq('status', 'summarized')
      .textSearch('search_vector', options.query, { type: 'plain', config: 'english' })
      .limit(500),
  ])

  const allMatchIds = [
    ...new Set([
      ...((summaryHits.data ?? []) as { meeting_id: string }[]).map((s) => s.meeting_id),
      ...((meetingHits.data ?? []) as { id: string }[]).map((m) => m.id),
    ]),
  ]

  if (allMatchIds.length === 0) {
    return { meetings: [], count: 0, page, pageSize, totalPages: 0 }
  }

  // Paginated fetch of full meeting+summary data by the merged ID set
  let fetchQuery = db
    .from('meetings')
    .select(MEETING_LIST_SELECT, { count: 'exact' })
    .eq('status', 'summarized')
    .in('id', allMatchIds)
    .order('meeting_date', { ascending: false })
    .range(from, from + pageSize - 1)

  if (options.body) {
    fetchQuery = fetchQuery.eq('body', options.body)
  }

  const { data, error, count } = await fetchQuery
  if (error) throw error

  return {
    meetings: dedupeMeetingsBySourceUrl(data ?? [])
      .map((row: Record<string, unknown>) => flattenSummary(row)),
    count: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  }
}

export async function getMeetingById(
  supabase: DBClient,
  id: string
): Promise<MeetingWithSummary | null> {
  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', id)
    .single()

  if (meetingError) {
    if (meetingError.code === 'PGRST116') return null
    throw meetingError
  }
  if (!meeting) return null

  const { data: summaries } = await supabase
    .from('summaries')
    .select('*')
    .eq('meeting_id', id)
    .limit(1)

  return Object.assign({}, meeting, { summary: summaries?.[0] ?? null }) as MeetingWithSummary
}
