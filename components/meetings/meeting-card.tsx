import Link from 'next/link'
import { VoteSeats, OutcomeStamp } from '@/components/record/vote-seats'
import { cleanAgendaTitle, docketDate, summaryExcerpt } from '@/components/record/format'
import type { MeetingWithSummary } from '@/types'
import type { MeetingMotionDigest } from '@/lib/data/motions'

interface MeetingCardProps {
  meeting: MeetingWithSummary
  digest?: MeetingMotionDigest
}

/** A meeting as one line in the ledger: date, what happened, and the closest vote. */
export function MeetingCard({ meeting, digest }: MeetingCardProps) {
  const date = docketDate(meeting.meeting_date)
  const closest = digest?.closest

  const docketParts = [meeting.body]
  if (digest && digest.motionCount > 0) {
    docketParts.push(`${digest.motionCount} motion${digest.motionCount === 1 ? '' : 's'}`)
  }

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="group grid grid-cols-[4.5rem_1fr] gap-x-4 gap-y-4 border-b border-border py-6 transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[5.5rem_1fr] md:grid-cols-[5.5rem_1fr_17rem] md:gap-x-8"
    >
      <div className="font-mono tabular-nums leading-none">
        <span className="block text-[11px] tracking-[0.08em] text-muted-foreground">{date.month}</span>
        <span className="mt-1 block text-[28px] font-semibold text-foreground">{date.day}</span>
        <span className="mt-1 block text-[11px] text-muted-foreground">{date.year}</span>
      </div>

      <div className="min-w-0">
        <p className="docket">
          {docketParts.join(' · ')}
          {digest && digest.failedCount > 0 && (
            <span className="text-destructive"> · {digest.failedCount} failed</span>
          )}
        </p>
        <h3 className="mt-1.5 text-[19px] font-bold leading-snug text-foreground group-hover:text-primary">
          {meeting.title}
        </h3>
        {meeting.summary ? (
          <p className="mt-2 line-clamp-2 max-w-[62ch] text-[14.5px] leading-relaxed text-muted-foreground">
            {summaryExcerpt(meeting.summary.summary_text)}
          </p>
        ) : (
          <p className="mt-2 text-[14px] text-muted-foreground">
            {meeting.status === 'processing' ? 'Summary in progress.' : 'Not summarized yet.'}
          </p>
        )}
      </div>

      {closest && (
        <div className="col-start-2 min-w-0 md:col-start-auto md:border-l md:border-border md:pl-6">
          <p className="docket">Closest vote</p>
          <p className="mt-1.5 line-clamp-2 text-[13.5px] font-medium leading-snug text-foreground">
            {closest.agendaItemOrder && (
              <span className="item-num mr-1.5 text-[12.5px]">{closest.agendaItemOrder}</span>
            )}
            {cleanAgendaTitle(closest.agendaItemTitle, closest.agendaItemOrder)}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <VoteSeats yes={closest.voteYes} no={closest.voteNo} abstain={closest.voteAbstain} />
            <OutcomeStamp
              outcome={closest.outcome}
              yes={closest.voteYes}
              no={closest.voteNo}
              abstain={closest.voteAbstain}
            />
          </div>
        </div>
      )}
    </Link>
  )
}
