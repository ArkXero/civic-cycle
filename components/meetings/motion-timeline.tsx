import { AlertCircle, CheckCircle2, Clock3, ExternalLink, FileQuestion, PauseCircle, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KeyDecisions } from './key-decisions'
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

function OutcomeBadge({ outcome }: { outcome: MotionTimelineItem['outcome'] }) {
  const styles = {
    passed: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
    failed: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400',
    postponed: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    tabled: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
    withdrawn: 'border-muted-foreground/30 bg-muted text-muted-foreground',
    unknown: 'border-muted-foreground/30 bg-muted text-muted-foreground',
  }[outcome]
  const Icon = outcome === 'passed'
    ? CheckCircle2
    : outcome === 'failed'
      ? XCircle
      : outcome === 'unknown'
        ? FileQuestion
        : outcome === 'withdrawn'
          ? PauseCircle
          : Clock3

  return (
    <Badge variant="outline" className={styles}>
      <Icon className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
      {outcome === 'unknown' ? 'Outcome not published' : outcome.replace('_', ' ')}
    </Badge>
  )
}

function ExactTally({ motion }: { motion: MotionTimelineItem }) {
  const hasTally = motion.vote_yes !== null || motion.vote_no !== null || motion.vote_abstain !== null
  if (!hasTally) {
    return <span className="text-sm text-muted-foreground">Recorded tally not published</span>
  }

  const tally = [
    motion.vote_yes === null ? null : `${motion.vote_yes} yes`,
    motion.vote_no === null ? null : `${motion.vote_no} no`,
    motion.vote_abstain === null ? null : `${motion.vote_abstain} abstain`,
  ].filter(Boolean).join(' · ')

  return (
    <span className="font-mono text-sm text-foreground" aria-label="Official vote tally">
      {tally}
    </span>
  )
}

function RollCall({ motion }: { motion: MotionTimelineItem }) {
  const hasNames =
    motion.roll_call_yes.length > 0 ||
    motion.roll_call_no.length > 0 ||
    motion.roll_call_abstain.length > 0
  if (!hasNames) return null

  return (
    <details className="group rounded-md border border-border bg-muted/30 px-3 py-2">
      <summary className="cursor-pointer text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        View official roll call
      </summary>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        {[
          ['Yes', motion.roll_call_yes],
          ['No', motion.roll_call_no],
          ['Abstain', motion.roll_call_abstain],
        ].map(([label, names]) => (
          <div key={label as string}>
            <dt className="font-medium text-foreground">{label as string}</dt>
            <dd className="mt-1 text-muted-foreground">
              {(names as string[]).length > 0 ? (names as string[]).join(', ') : 'None listed'}
            </dd>
          </div>
        ))}
      </dl>
    </details>
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
      <Card aria-busy="true" aria-label="Loading official motions">
        <CardHeader><CardTitle className="text-lg">Official Motions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {[0, 1, 2].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-lg bg-muted" />
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <div className="space-y-3">
        <Card className="border-destructive/30">
          <CardContent className="flex gap-3 py-5" role="alert">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">Official motion timeline unavailable</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
        {legacyDecisions.length > 0 && <KeyDecisions decisions={legacyDecisions} />}
      </div>
    )
  }

  if (motions.length === 0) {
    if (legacyDecisions.length > 0) {
      return (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Legacy summary data · official motion timeline not yet available
          </p>
          <KeyDecisions decisions={legacyDecisions} />
        </div>
      )
    }

    return (
      <Card>
        <CardHeader><CardTitle className="text-lg">Official Motions</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No post-meeting motion results have been published by BoardDocs yet.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-lg">Official Motion Timeline</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Source order preserved from post-meeting BoardDocs records.
          </p>
        </div>
        {boardDocsUrl && (
          <a
            href={boardDocsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            BoardDocs source <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-5 before:absolute before:bottom-3 before:left-[0.4375rem] before:top-3 before:w-px before:bg-border sm:before:left-[0.5625rem]">
          {motions.map((motion) => (
            <li key={motion.id} className="relative pl-7 sm:pl-9">
              <span
                className={`absolute left-0 top-5 h-3.5 w-3.5 rounded-full border-2 border-background ring-2 ring-border sm:h-[1.125rem] sm:w-[1.125rem] ${
                  motion.is_final && !motion.is_superseded ? 'bg-primary ring-primary/40' : 'bg-muted-foreground'
                }`}
                aria-hidden="true"
              />
              <article className={`rounded-lg border p-4 sm:p-5 ${
                motion.is_final && !motion.is_superseded ? 'border-primary/40 bg-primary/[0.03]' : 'border-border'
              }`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {motion.agenda_item_order} · {motion.agenda_item_title}
                    </p>
                    <h3 className="mt-1 font-semibold text-foreground">{motionLabels[motion.motion_type]}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <OutcomeBadge outcome={motion.outcome} />
                    {motion.is_final && !motion.is_superseded && (
                      <Badge>Final operative wording</Badge>
                    )}
                    {motion.is_superseded && <Badge variant="secondary">Superseded</Badge>}
                  </div>
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground sm:text-base">
                  {motion.normalized_motion_text}
                </p>

                <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                  <ExactTally motion={motion} />
                  {(motion.mover || motion.seconder) && (
                    <p className="text-sm text-muted-foreground sm:text-right">
                      {motion.mover && <span>Moved by {motion.mover}</span>}
                      {motion.mover && motion.seconder && <span> · </span>}
                      {motion.seconder && <span>Seconded by {motion.seconder}</span>}
                    </p>
                  )}
                </div>

                <div className="mt-3"><RollCall motion={motion} /></div>
              </article>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
