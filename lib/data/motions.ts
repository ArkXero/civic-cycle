import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import type { AgendaItemMotion } from '@/types'
import type { OfficialMotion } from '@/lib/anthropic'

type DatabaseClient = SupabaseClient<Database>

export interface MotionTimelineItem extends AgendaItemMotion {
  agenda_item_order: string
  agenda_item_title: string
}

function compareAgendaOrder(left: string, right: string) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
}

export async function getMeetingMotionTimeline(
  supabase: DatabaseClient,
  meetingId: string
): Promise<MotionTimelineItem[]> {
  const [agendaResult, motionResult] = await Promise.all([
    supabase
      .from('agenda_items')
      .select('id, item_order, title')
      .eq('meeting_id', meetingId),
    supabase
      .from('agenda_item_motions')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('source_ordinal'),
  ])

  if (agendaResult.error) throw agendaResult.error
  if (motionResult.error) throw motionResult.error

  const agendaById = new Map(
    (agendaResult.data ?? []).map((item) => [item.id, item])
  )

  return (motionResult.data ?? [])
    .map((motion) => {
      const agendaItem = agendaById.get(motion.agenda_item_id)
      return {
        ...motion,
        agenda_item_order: agendaItem?.item_order ?? '',
        agenda_item_title: agendaItem?.title ?? 'Agenda item',
      }
    })
    .sort((left, right) =>
      compareAgendaOrder(left.agenda_item_order, right.agenda_item_order) ||
      left.source_ordinal - right.source_ordinal
    )
}

export function officialMotionsFromRows(rows: AgendaItemMotion[]): OfficialMotion[] {
  return rows.map((motion) => ({
    contentHash: motion.content_hash,
    normalizedText: motion.normalized_motion_text,
    motionType: motion.motion_type,
    outcome: motion.outcome,
    voteYes: motion.vote_yes,
    voteNo: motion.vote_no,
    voteAbstain: motion.vote_abstain,
    isFinal: motion.is_final,
    isSuperseded: motion.is_superseded,
  }))
}

export interface MeetingMotionDigest {
  motionCount: number
  failedCount: number
  /** Closest recorded vote with at least one dissent, if any. */
  closest: {
    agendaItemOrder: string
    agendaItemTitle: string
    outcome: AgendaItemMotion['outcome']
    voteYes: number
    voteNo: number
    voteAbstain: number
  } | null
}

/**
 * Per-meeting motion counts and the closest split vote, for list views.
 * Superseded motions are excluded so counts match the operative record.
 */
export async function getMotionDigestsByMeetingIds(
  supabase: DatabaseClient,
  meetingIds: string[]
): Promise<Map<string, MeetingMotionDigest>> {
  const digests = new Map<string, MeetingMotionDigest>()
  if (meetingIds.length === 0) return digests

  const { data: motions, error } = await supabase
    .from('agenda_item_motions')
    .select('meeting_id, agenda_item_id, outcome, vote_yes, vote_no, vote_abstain, is_superseded')
    .in('meeting_id', meetingIds)
  if (error) throw error

  const operative = (motions ?? []).filter((motion) => !motion.is_superseded)
  const agendaIds = [...new Set(operative.map((motion) => motion.agenda_item_id))]
  const agendaById = new Map<string, { item_order: string; title: string }>()

  if (agendaIds.length > 0) {
    const { data: agendaItems, error: agendaError } = await supabase
      .from('agenda_items')
      .select('id, item_order, title')
      .in('id', agendaIds)
    if (agendaError) throw agendaError
    for (const item of agendaItems ?? []) agendaById.set(item.id, item)
  }

  for (const motion of operative) {
    const digest = digests.get(motion.meeting_id) ?? { motionCount: 0, failedCount: 0, closest: null }
    digest.motionCount += 1
    if (motion.outcome === 'failed') digest.failedCount += 1

    const yes = motion.vote_yes ?? 0
    const no = motion.vote_no ?? 0
    if (motion.vote_yes !== null && no > 0) {
      const margin = Math.abs(yes - no)
      const currentMargin = digest.closest
        ? Math.abs(digest.closest.voteYes - digest.closest.voteNo)
        : Infinity
      if (margin < currentMargin) {
        const agendaItem = agendaById.get(motion.agenda_item_id)
        digest.closest = {
          agendaItemOrder: agendaItem?.item_order ?? '',
          agendaItemTitle: agendaItem?.title ?? 'Agenda item',
          outcome: motion.outcome,
          voteYes: yes,
          voteNo: no,
          voteAbstain: motion.vote_abstain ?? 0,
        }
      }
    }
    digests.set(motion.meeting_id, digest)
  }

  return digests
}
