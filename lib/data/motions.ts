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
