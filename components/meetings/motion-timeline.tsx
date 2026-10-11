import { AlertCircle, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { KeyDecisions } from './key-decisions'
import { VoteSeats, OutcomeStamp } from '@/components/record/vote-seats'
import { cleanAgendaTitle } from '@/components/record/format'
import type { KeyDecision } from '@/types'
import type { MotionTimelineItem } from '@/lib/data/motions'

interface MotionTimelineProps {
  motions: MotionTimelineItem[]
  legacyDecisions: KeyDecision[]
  boardDocsUrl?: string | null
  error?: string | null
  loading?: boolean
}

const motionLabels: Record<MotionTimelineItem['motion_type'], string> = {
  original: 'Original motion',
  main: 'Main motion',
  amendment: 'Amendment',
  amendment_to_amendment: 'Amendment to amendment',
  amended_amendment: 'Amended amendment',
  amended_final: 'Final amended motion',
  procedural: 'Procedural motion',
  postponed: 'Motion to postpone',
  tabled: 'Motion to table',
  withdrawn: 'Withdrawn motion',
  other: 'Motion',
}

export interface AgendaGroup {
  order: string
  title: string
  motions: MotionTimelineItem[]
}

/** Group motions by agenda item, preserving BoardDocs source order. */
export function groupMotionsByAgendaItem(motions: MotionTimelineItem[]): AgendaGroup[] {
  const groups: AgendaGroup[] = []
  for (const motion of motions) {
    const last = groups[groups.length - 1]
    if (last && last.order === motion.agenda_item_order) {
      last.motions.push(motion)
    } else {
      groups.push({
        order: motion.agenda_item_order,
        title: cleanAgendaTitle(motion.agenda_item_title, motion.agenda_item_order),
        motions: [motion],
      })
    }
  }
  return groups
}

export function agendaAnchor(order: string) {
  return `item-${order.replace(/[^\w-]/g, '-') || 'unnumbered'}`
}

function RollCall({ motion }: { motion: MotionTimelineItem }) {
  const hasNames =
    motion.roll_call_yes.length > 0 ||
    motion.roll_call_no.length > 0 ||
    motion.roll_call_abstain.length > 0
  if (!hasNames) return null

  return (
    <details className="group mt-3">
      <summary className="cursor-pointer text-[13px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm w-fit">
        Roll call
      </summary>
      <dl className="mt-2.5 grid gap-3 rounded-md border border-border bg-secondary/50 p-3 text-[13px] sm:grid-cols-3">
        {[
          ['Yes', motion.roll_call_yes],
          ['No', motion.roll_call_no],
          ['Abstain', motion.roll_call_abstain],
        ].map(([label, names]) => (
          <div key={label as string}>
            <dt className="docket">{label as string}</dt>
            <dd className="mt-1 text-foreground/80">
              {(names as string[]).length > 0 ? (names as string[]).join(', ') : 'None listed'}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

function MotionRow({ motion }: { motion: MotionTimelineItem }) {
  const isOperativeFinal = motion.is_final && !motion.is_superseded
  const hasTally = motion.vote_yes !== null || motion.vote_no !== null || motion.vote_abstain !== null

  return (
    <div className={cn('grid gap-3 sm:grid-cols-[1fr_auto] sm:gap-6', motion.is_superseded && 'opacity-60')}>
      <div className="min-w-0">
        <p className="docket">
          {motionLabels[motion.motion_type]}
          {isOperativeFinal && <span className="text-primary"> · Final operative wording</span>}
          {motion.is_superseded && <span> · Superseded</span>}
        </p>
        <p className="mt-1.5 max-w-[68ch] whitespace-pre-wrap text-[14.5px] leading-relaxed text-foreground/85">
          {motion.normalized_motion_text}
        </p>
        {hasTally ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <VoteSeats yes={motion.vote_yes} no={motion.vote_no} abstain={motion.vote_abstain} />
            <span className="font-mono text-[12px] tabular-nums text-muted-foreground" aria-label="Official vote tally">
              {[
                motion.vote_yes === null ? null : `${motion.vote_yes} yes`,
                motion.vote_no === null ? null : `${motion.vote_no} no`,
                motion.vote_abstain === null ? null : `${motion.vote_abstain} abstain`,
              ].filter(Boolean).join(' · ')}
            </span>
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-muted-foreground">Recorded tally not published</p>
        )}
        {(motion.mover || motion.seconder) && (
          <p className="mt-2 text-[13px] text-muted-foreground">
            {motion.mover && <span>Moved by {motion.mover}</span>}
            {motion.mover && motion.seconder && <span> · </span>}
            {motion.seconder && <span>Seconded by {motion.seconder}</span>}
          </p>
        )}
        <RollCall motion={motion} />
      </div>
      <div className="sm:pt-5">
        <OutcomeStamp
          outcome={motion.outcome}
          yes={motion.vote_yes}
          no={motion.vote_no}
          abstain={motion.vote_abstain}
        />
      </div>
    </div>
  )
}

function SectionHeading({ boardDocsUrl }: { boardDocsUrl?: string | null }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-rule pb-3">
      <div>
        <h2 className="text-xl font-extrabold text-foreground">The record</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Every motion in agenda order, from post-meeting BoardDocs records.
        </p>
      </div>
      {boardDocsUrl && (
        <a
          href={boardDocsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          BoardDocs source <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}
    </div>
  )
}

export function MotionTimeline({
  motions,
  legacyDecisions,
  boardDocsUrl,
  error,
  loading = false,
}: MotionTimelineProps) {
  if (loading) {
    return (
      <section aria-busy="true" aria-label="Loading official motions" className="space-y-4">
        <SectionHeading boardDocsUrl={boardDocsUrl} />
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-md bg-muted" />
        ))}
      </section>
    )
  }

  if (error) {
    return (
      <section className="space-y-4">
        <SectionHeading boardDocsUrl={boardDocsUrl} />
        <div className="flex gap-3 rounded-md border border-destructive/30 p-4" role="alert">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <p className="font-medium text-foreground">Official motion record unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
        {legacyDecisions.length > 0 && <KeyDecisions decisions={legacyDecisions} />}
      </section>
    )
  }

  if (motions.length === 0) {
    return (
      <section className="space-y-4">
        <SectionHeading boardDocsUrl={boardDocsUrl} />
        {legacyDecisions.length > 0 ? (
          <>
            <p className="docket">Legacy summary data · official motions not yet available</p>
            <KeyDecisions decisions={legacyDecisions} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No post-meeting motion results have been published by BoardDocs yet.
          </p>
        )}
      </section>
    )
  }

  const groups = groupMotionsByAgendaItem(motions)

  return (
    <section className="space-y-0">
      <SectionHeading boardDocsUrl={boardDocsUrl} />
      <ol>
        {groups.map((group) => (
          <li
            key={`${group.order}-${group.motions[0].id}`}
            id={agendaAnchor(group.order)}
            className="grid scroll-mt-24 grid-cols-[3.25rem_1fr] gap-x-3 border-b border-border py-6 sm:grid-cols-[4rem_1fr] sm:gap-x-4"
          >
            <span className="item-num pt-0.5 text-[14px]">{group.order || '—'}</span>
            <div className="min-w-0">
              <h3 className="mb-3 text-[16px] font-bold leading-snug text-foreground">{group.title}</h3>
              <div className="space-y-7">
                {group.motions.map((motion) => (
                  <MotionRow key={motion.id} motion={motion} />
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
