import Link from 'next/link'
import { Calendar, Building2, ExternalLink, ArrowRight } from 'lucide-react'
import { formatDate, truncate } from '@/lib/utils'
import type { MeetingWithSummary } from '@/types'

interface MeetingCardProps {
  meeting: MeetingWithSummary
  /** Pass true when rendering on a light background section */
  light?: boolean
}

export function MeetingCard({ meeting, light = false }: MeetingCardProps) {
  const cardBg = light
    ? 'rgba(255,255,255,0.9)'
    : 'rgba(13, 94, 107, 0.15)'
  const cardBorder = light
    ? 'rgba(26,138,154,0.2)'
    : 'rgba(26,138,154,0.25)'
  const titleColor = light ? '#0A3038' : '#F4F8F9'
  const metaColor = light ? '#5B8A94' : '#5B8A94'
  const bodyColor = light ? '#0A3038' : 'rgba(244,248,249,0.70)'

  return (
    <Link href={`/meetings/${meeting.id}`} className="block group">
      <div
        className="h-full rounded-xl p-6 transition-all duration-200 group-hover:-translate-y-0.5 cursor-pointer"
        style={{
          background: cardBg,
          border: `1px solid ${cardBorder}`,
          backdropFilter: 'blur(12px)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'rgba(43,189,212,0.5)'
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(26,138,154,0.2)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = cardBorder
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        {/* Date + body metadata */}
        <div
          className="flex items-center gap-2 text-xs mb-4"
          style={{
            color: metaColor,
            fontFamily: 'var(--font-body-var), monospace',
          }}
        >
          <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{meeting.body}</span>
          <span className="text-current opacity-40">•</span>
          <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{formatDate(meeting.meeting_date)}</span>
        </div>

        {/* Title */}
        <h3
          className="text-lg leading-snug line-clamp-2 mb-3"
          style={{
            color: titleColor,
            fontFamily: 'var(--font-display-var), Georgia, serif',
          }}
        >
          {meeting.title}
        </h3>

        {/* Summary excerpt */}
        {meeting.summary && (
          <p
            className="text-sm leading-relaxed line-clamp-3 mb-4"
            style={{
              color: bodyColor,
              fontFamily: 'var(--font-body-var), monospace',
            }}
          >
            {truncate(meeting.summary.summary_text, 200)}
          </p>
        )}

        {/* Topic tags */}
        {meeting.summary?.topics && meeting.summary.topics.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {meeting.summary.topics.slice(0, 4).map((topic) => (
              <span
                key={topic}
                className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold tracking-wide"
                style={{
                  background: 'rgba(245,166,35,0.15)',
                  color: '#F5A623',
                  fontFamily: 'var(--font-body-var), monospace',
                }}
              >
                {topic}
              </span>
            ))}
            {meeting.summary.topics.length > 4 && (
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold"
                style={{
                  background: 'rgba(26,138,154,0.12)',
                  color: '#2BBDD4',
                  fontFamily: 'var(--font-body-var), monospace',
                }}
              >
                +{meeting.summary.topics.length - 4} more
              </span>
            )}
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between mt-auto pt-1">
          {meeting.source_url ? (
            <span
              className="text-xs flex items-center gap-1"
              style={{
                color: metaColor,
                fontFamily: 'var(--font-body-var), monospace',
              }}
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
