import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { MotionTimeline, groupMotionsByAgendaItem, agendaAnchor } from './motion-timeline'
import { ActionItems } from './action-items'
import { SummarizeButton } from './summarize-button'
import { RetagButton } from './retag-button'
import { formatDate } from '@/lib/utils'
import type { MeetingWithSummary } from '@/types'
import type { MotionTimelineItem } from '@/lib/data/motions'

interface MeetingDetailProps {
  meeting: MeetingWithSummary
  isAuthenticated?: boolean
  isAdmin?: boolean
  motions?: MotionTimelineItem[]
  motionError?: string | null
}

export function MeetingDetail({
  meeting,
  isAuthenticated = false,
  isAdmin = false,
  motions = [],
  motionError = null,
}: MeetingDetailProps) {
  const groups = groupMotionsByAgendaItem(motions)
  const operative = motions.filter((motion) => !motion.is_superseded)
  const failedCount = operative.filter((motion) => motion.outcome === 'failed').length
  const paragraphs = meeting.summary?.summary_text.split('\n\n').filter(Boolean) ?? []
  const weekday = new Date(meeting.meeting_date).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })

  return (
    <div className="lg:grid lg:grid-cols-[13rem_1fr] lg:gap-12">
      {/* Agenda index */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 space-y-6">
          <Link
            href="/meetings"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All meetings
          </Link>
          {groups.length > 0 && (
            <nav aria-label="Agenda items">
              <p className="docket mb-2">Agenda</p>
              <ol className="max-h-[60vh] space-y-0.5 overflow-y-auto pr-1">
                {groups.map((group) => (
                  <li key={`${group.order}-${group.motions[0].id}`}>
                    <a
                      href={`#${agendaAnchor(group.order)}`}
                      className="flex gap-2.5 rounded-sm px-1.5 py-1 text-[13px] leading-snug text-foreground/80 hover:bg-secondary hover:text-foreground"
                    >
                      <span className="item-num w-9 shrink-0 text-[12px]">{group.order || '—'}</span>
                      <span className="line-clamp-2">{group.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          {operative.length > 0 && (
            <dl className="grid grid-cols-2 gap-3 border-t border-border pt-4">
              <div>
                <dt className="docket">Motions</dt>
                <dd className="mt-0.5 font-mono text-xl font-semibold tabular-nums">{operative.length}</dd>
              </div>
              <div>
                <dt className="docket">Failed</dt>
                <dd className={`mt-0.5 font-mono text-xl font-semibold tabular-nums ${failedCount > 0 ? 'text-destructive' : ''}`}>
                  {failedCount}
                </dd>
              </div>
            </dl>
          )}
        </div>
      </aside>

      <div className="min-w-0 space-y-10">
        {/* Docket header */}
        <header className="space-y-4">
          <Link
            href="/meetings"
            className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground lg:hidden"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All meetings
          </Link>
          <p className="docket">
            {meeting.body} · {weekday} · {operative.length > 0 ? `${operative.length} motions` : 'Agenda'}
          </p>
          <h1 className="text-[clamp(2rem,4.5vw,2.75rem)] font-extrabold leading-[1.05] tracking-[-0.025em] text-foreground">
            {meeting.title}
            <span className="block text-muted-foreground">{formatDate(meeting.meeting_date)}</span>
          </h1>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {meeting.source_url && (
              <a
                href={meeting.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Full agenda on BoardDocs
              </a>
            )}
            {meeting.approvedTopics.map((topic) => (
              <Link
                key={topic.id}
                href={`/meetings?topic=${encodeURIComponent(topic.slug)}`}
                className="rounded-sm border border-border px-2 py-0.5 text-[12px] font-medium text-foreground/75 hover:border-primary hover:text-primary"
              >
                {topic.display_name}
              </Link>
            ))}
          </div>

          {isAuthenticated && (
            <div className="flex flex-wrap gap-4 pt-1">
              <SummarizeButton
                meetingId={meeting.id}
                hasSummary={!!meeting.summary}
                hasTranscript={!!meeting.transcript_text}
                status={meeting.status}
              />
              {isAdmin && <RetagButton meetingId={meeting.id} />}
            </div>
          )}
        </header>

        {meeting.summary ? (
          <>
            {/* Summary as standfirst */}
            <section aria-label="Summary" className="max-w-[68ch] space-y-4 border-l-2 border-accent pl-5">
              {paragraphs.map((paragraph, index) => (
                <p
                  key={index}
                  className={index === 0
                    ? 'text-[17px] leading-[1.65] text-foreground'
                    : 'text-[15px] leading-relaxed text-foreground/80'}
                >
                  {paragraph}
                </p>
              ))}
            </section>

            <MotionTimeline
              motions={motions}
              legacyDecisions={meeting.summary.key_decisions}
              boardDocsUrl={meeting.source_url}
              error={motionError}
            />

            <ActionItems items={meeting.summary.action_items} />
          </>
        ) : (
          <div className="rounded-md border border-dashed border-border px-6 py-10 text-center">
            <NoSummaryState meeting={meeting} isAuthenticated={isAuthenticated} />
          </div>
        )}

        <p className="border-t border-border pt-4 text-[13px] text-muted-foreground">
          Summaries are generated with AI from the official agenda. Vote tallies and motion text
          come directly from BoardDocs. Always check the{' '}
          {meeting.source_url ? (
            <a
              href={meeting.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              original agenda
            </a>
          ) : (
            'original source'
          )}{' '}
          for official information.
        </p>
      </div>
    </div>
  )
}

function NoSummaryState({
  meeting,
  isAuthenticated,
}: {
  meeting: MeetingWithSummary
  isAuthenticated: boolean
}) {
  if (meeting.status === 'processing') {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground font-medium">Summary is being generated.</p>
        <p className="text-sm text-muted-foreground">Check back in a few minutes.</p>
      </div>
    )
  }
  if (meeting.status === 'failed') {
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground font-medium">Summary generation failed.</p>
        {meeting.error_message && (
          <p className="text-sm text-destructive">{meeting.error_message}</p>
        )}
        {isAuthenticated && (
          <p className="text-sm text-muted-foreground mt-2">
            Use the Regenerate button above to try again.
          </p>
        )}
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground font-medium">No summary available yet.</p>
      {!meeting.transcript_text && (
        <p className="text-sm text-muted-foreground">
          Import meeting content first using the admin panel.
        </p>
      )}
      {meeting.transcript_text && !isAuthenticated && (
        <p className="text-sm text-muted-foreground">Sign in to generate a summary.</p>
      )}
    </div>
  )
}
