import Link from 'next/link'
import { Calendar, Building2, ExternalLink, ArrowRight } from 'lucide-react'
import { formatDate, truncate } from '@/lib/utils'
import type { MeetingWithSummary } from '@/types'

interface MeetingCardProps {
  meeting: MeetingWithSummary
}

export function MeetingCard({ meeting }: MeetingCardProps) {
  return (
    <Link href={`/meetings/${meeting.id}`} className="block group">
      <div
        className="h-full rounded-xl p-6 transition-all duration-200 group-hover:-translate-y-0.5 cursor-pointer"
        style={{
          background: 'rgba(13, 94, 107, 0.12)',
          border: '1px solid rgba(26,138,154,0.25)',
          backdropFilter: 'blur(12px)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(245,166,35,0.5)'
          e.currentTarget.style.boxShadow = '0 0 28px rgba(245,166,35,0.22)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(26,138,154,0.25)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        {/* Date + body metadata */}
        <div
          className="flex items-center gap-2 text-xs mb-4 text-muted-foreground"
          style={{ fontFamily: 'var(--font-body-var), monospace' }}
        >
          <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{meeting.body}</span>
          <span className="opacity-40">•</span>
          <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{formatDate(meeting.meeting_date)}</span>
        </div>

        {/* Title */}
        <h3
          className="text-lg leading-snug line-clamp-2 mb-3 text-foreground"
          style={{ fontFamily: 'var(--font-display-var), Georgia, serif' }}
        >
          {meeting.title}
        </h3>

        {/* Summary excerpt */}
        {meeting.summary && (
          <p
            className="text-sm leading-relaxed line-clamp-3 mb-4 text-foreground/70"
            style={{ fontFamily: 'var(--font-body-var), monospace' }}
          >
            {truncate(meeting.summary.summary_text, 200)}
          </p>
        )}


        {/* Footer row */}
        <div className="flex items-center justify-between mt-auto pt-1">
          {meeting.source_url ? (
            <span
              className="text-xs flex items-center gap-1 text-muted-foreground"
              style={{ fontFamily: 'var(--font-body-var), monospace' }}
            >
              <ExternalLink className="h-3 w-3" />
              Agenda on BoardDocs
            </span>
          ) : (
            <span />
          )}
          <span
            className="inline-flex items-center gap-1 text-xs font-medium"
            style={{
              color: '#1A8A9A',
              fontFamily: 'var(--font-body-var), monospace',
            }}
          >
            Read Summary
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  )
}
