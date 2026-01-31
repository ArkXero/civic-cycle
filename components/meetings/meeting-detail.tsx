import Link from 'next/link'
import Image from 'next/image'
import { Calendar, Building2, ExternalLink, ArrowLeft, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { KeyDecisions } from './key-decisions'
import { ActionItems } from './action-items'
import { SummarizeButton } from './summarize-button'
import { TranscriptFetcher } from '@/components/youtube/transcript-fetcher'
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
            <TranscriptFetcher
              meetingId={meeting.id}
              hasTranscript={!!meeting.transcript_text}
              hasVideoUrl={!!meeting.video_url}
            />
            <SummarizeButton
              meetingId={meeting.id}
              hasSummary={!!meeting.summary}
              hasTranscript={!!meeting.transcript_text}
              status={meeting.status}
            />
          </div>
        )}
      </div>

      {/* Video card with thumbnail */}
      {meeting.video_url && (
        <Card className="bg-primary/5 border-primary/20 overflow-hidden">
          <CardContent className="p-0">
            <a
              href={meeting.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col sm:flex-row"
            >
              {meeting.youtube_thumbnail_url ? (
                <div className="relative w-full sm:w-48 h-32 bg-muted flex-shrink-0">
                  <Image
                    src={meeting.youtube_thumbnail_url}
                    alt={meeting.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, 192px"
                  />
                  {meeting.youtube_duration && (
                    <Badge className="absolute bottom-2 right-2 bg-black/80 text-white text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {meeting.youtube_duration}
                    </Badge>
                  )}
                </div>
              ) : null}
              <div className="p-4 flex items-center gap-2 text-primary hover:underline">
                <ExternalLink className="h-4 w-4 flex-shrink-0" />
                <span>Watch the full meeting video</span>
              </div>
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
            <p className="text-muted-foreground">
              Summary is being processed. Check back soon.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Source info */}
      <div className="text-sm text-muted-foreground border-t border-border pt-4">
        <p>
          This summary was generated using AI from the official meeting transcript.
          Always refer to the{' '}
          {meeting.video_url ? (
            <a
              href={meeting.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              original video
            </a>
          ) : (
            'original recording'
          )}{' '}
          for official information.
        </p>
      </div>
    </div>
  )
}
