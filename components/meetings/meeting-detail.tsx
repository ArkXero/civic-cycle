import Link from 'next/link'
import { Calendar, Building2, ExternalLink, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KeyDecisions } from './key-decisions'
import { ActionItems } from './action-items'
import { SummarizeButton } from './summarize-button'
import { formatDate } from '@/lib/utils'
import type { MeetingWithSummary } from '@/types'

interface MeetingDetailProps {
  meeting: MeetingWithSummary
  isAuthenticated?: boolean
}

export function MeetingDetail({ meeting, isAuthenticated = false }: MeetingDetailProps) {
  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" asChild className="mb-4">
        <Link href="/meetings">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Meetings
        </Link>
      </Button>

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Building2 className="h-4 w-4" />
          <span>{meeting.body}</span>
          <span className="text-border">•</span>
          <Calendar className="h-4 w-4" />
          <span>{formatDate(meeting.meeting_date)}</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">
          {meeting.title}
        </h1>

        {/* Topics */}
        {meeting.summary?.topics && meeting.summary.topics.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {meeting.summary.topics.map((topic) => (
              <Badge key={topic} variant="secondary">
                {topic}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions for authenticated users */}
        {isAuthenticated && (
          <div className="mt-4 flex flex-wrap gap-4">
            <SummarizeButton
              meetingId={meeting.id}
              hasSummary={!!meeting.summary}
              hasTranscript={!!meeting.transcript_text}
              status={meeting.status}
            />
          </div>
        )}
      </div>

      {/* BoardDocs source link */}
      {meeting.source_url && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <a
              href={meeting.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4 flex-shrink-0" />
              <span>View the full agenda on BoardDocs</span>
            </a>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {meeting.summary ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-foreground">
                {meeting.summary.summary_text.split('\n\n').map((paragraph, index) => (
                  <p key={index} className="mb-4 last:mb-0">
                    {paragraph}
                  </p>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Key Decisions */}
          <KeyDecisions decisions={meeting.summary.key_decisions} />

          {/* Action Items */}
          <ActionItems items={meeting.summary.action_items} />
        </>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            {meeting.status === 'processing' && (
              <div className="space-y-2">
                <p className="text-muted-foreground font-medium">
                  Summary is being generated.
                </p>
                <p className="text-sm text-muted-foreground">
                  Check back in a few minutes.
                </p>
              </div>
            )}
            {meeting.status === 'failed' && (
              <div className="space-y-2">
                <p className="text-muted-foreground font-medium">
                  Summary generation failed.
                </p>
                {meeting.error_message && (
                  <p className="text-sm text-destructive">{meeting.error_message}</p>
                )}
                {isAuthenticated && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Use the Regenerate button above to try again.
                  </p>
                )}
              </div>
            )}
            {(meeting.status === 'pending' || meeting.status === 'summarized') && (
              <div className="space-y-2">
                <p className="text-muted-foreground font-medium">
                  No summary available yet.
                </p>
                {!meeting.transcript_text && (
                  <p className="text-sm text-muted-foreground">
                    Import meeting content first using the admin panel.
                  </p>
                )}
                {meeting.transcript_text && !isAuthenticated && (
                  <p className="text-sm text-muted-foreground">
                    Sign in to generate a summary.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Source info */}
      <div className="text-sm text-muted-foreground border-t border-border pt-4">
        <p>
          This summary was generated using AI from the official meeting agenda.
          Always refer to the{' '}
          {meeting.source_url ? (
            <a
              href={meeting.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              original agenda on BoardDocs
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
