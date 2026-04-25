import Link from 'next/link'
import { Calendar, Building2, ExternalLink, ArrowRight } from 'lucide-react'
import { formatDate, truncate } from '@/lib/utils'
import type { MeetingWithSummary } from '@/types'

interface MeetingCardProps {
  meeting: MeetingWithSummary
}

export function MeetingCard({ meeting }: MeetingCardProps) {
  return (
    <Link href={`/meetings/${meeting.id}`} className="block group h-full">
      <div className="h-full flex flex-col rounded-[10px] p-6 bg-card border border-border transition-[box-shadow,border-color,transform] duration-200 group-hover:shadow-[0_6px_20px_rgba(10,48,56,0.09)] group-hover:border-[rgba(26,138,154,0.4)] group-hover:-translate-y-0.5 dark:group-hover:shadow-[0_6px_24px_rgba(0,0,0,0.3)]">

        {/* Metadata row */}
        <div
          className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mb-3.5"
          style={{ fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif' }}
        >
          <Building2 className="h-3 w-3 flex-shrink-0" strokeWidth={2} />
          <span className="truncate">{meeting.body}</span>
          <span className="opacity-40 mx-0.5">·</span>
          <Calendar className="h-3 w-3 flex-shrink-0" strokeWidth={2} />
          <span className="flex-shrink-0">{formatDate(meeting.meeting_date)}</span>
        </div>

        {/* Title */}
        <h3
          className="text-[17px] leading-snug text-foreground mb-3 line-clamp-2"
          style={{ fontFamily: 'var(--font-display-var), Georgia, serif', fontWeight: 400 }}
        >
          {meeting.title}
        </h3>

        {/* Summary excerpt */}
        {meeting.summary && (
          <p
            className="text-[13.5px] leading-relaxed text-muted-foreground line-clamp-3 flex-1 mb-5"
            style={{ fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif' }}
          >
            {truncate(meeting.summary.summary_text, 200)}
          </p>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-between mt-auto pt-4 border-t border-border"
        >
          {meeting.source_url ? (
            <span
              className="flex items-center gap-1 text-[11px] text-muted-foreground"
              style={{ fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif' }}
            >
              <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
              BoardDocs agenda
            </span>
          ) : (
            <span />
          )}

          <span
            className="flex items-center gap-1 text-[13px] font-semibold text-primary transition-colors"
            style={{ fontFamily: 'var(--font-body-var), ui-sans-serif, system-ui, sans-serif' }}
          >
            Read Summary
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2.5} />
          </span>
        </div>

      </div>
    </Link>
  )
}
