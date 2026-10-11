import { cn } from '@/lib/utils'
import type { MotionOutcome } from '@/types'
import { OUTCOME_LABEL, formatTally } from './format'

interface VoteSeatsProps {
  yes: number | null
  no: number | null
  abstain: number | null
  className?: string
}

/** One square per recorded vote: yes in primary teal, no in destructive, abstain muted. */
export function VoteSeats({ yes, no, abstain, className }: VoteSeatsProps) {
  const seats = [
    ...Array<string>(yes ?? 0).fill('yes'),
    ...Array<string>(no ?? 0).fill('no'),
    ...Array<string>(abstain ?? 0).fill('abstain'),
  ]
  if (seats.length === 0) return null

  const label = [
    `${yes ?? 0} yes`,
    `${no ?? 0} no`,
    abstain ? `${abstain} abstain` : null,
  ].filter(Boolean).join(', ')

  return (
    <div className={cn('flex flex-wrap gap-[3px]', className)} role="img" aria-label={label}>
      {seats.map((kind, index) => (
        <span
          key={index}
          className={cn(
            'h-[11px] w-[11px] rounded-[2px]',
            kind === 'yes' && 'bg-primary',
            kind === 'no' && 'bg-(--vote-no)',
            kind === 'abstain' && 'bg-muted-foreground/35'
          )}
        />
      ))}
    </div>
  )
}

const stampColor: Record<MotionOutcome, string> = {
  passed: 'text-(--stamp-passed)',
  failed: 'text-destructive',
  postponed: 'text-(--stamp-held)',
  tabled: 'text-(--stamp-held)',
  withdrawn: 'text-muted-foreground',
  unknown: 'text-muted-foreground',
}

interface OutcomeStampProps {
  outcome: MotionOutcome
  yes?: number | null
  no?: number | null
  abstain?: number | null
  className?: string
}

/** "PASSED 8–4" in the style of a clerk's stamp. */
export function OutcomeStamp({ outcome, yes = null, no = null, abstain = null, className }: OutcomeStampProps) {
  const tally = outcome === 'unknown' ? null : formatTally(yes, no, abstain)
  return (
    <span className={cn('stamp', stampColor[outcome], className)}>
      {OUTCOME_LABEL[outcome]}
      {tally && <span className="ml-1.5">{tally}</span>}
    </span>
  )
}
