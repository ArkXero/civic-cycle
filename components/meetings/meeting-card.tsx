import Link from 'next/link'
import { Calendar, Building2, ExternalLink } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, truncate } from '@/lib/utils'
import type { MeetingWithSummary } from '@/types'

interface MeetingCardProps {
  meeting: MeetingWithSummary
}

export function MeetingCard({ meeting }: MeetingCardProps) {
  return (
    <Link href={`/meetings/${meeting.id}`}>
      <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Building2 className="h-4 w-4" />
            <span>{meeting.body}</span>
            <span className="text-border">•</span>
            <Calendar className="h-4 w-4" />
            <span>{formatDate(meeting.meeting_date)}</span>
          </div>
          <CardTitle className="text-lg line-clamp-2">{meeting.title}</CardTitle>
          {meeting.summary && (
            <CardDescription className="line-clamp-3 mt-2">
              {truncate(meeting.summary.summary_text, 200)}
            </CardDescription>
          )}
        </CardHeader>

        {meeting.summary?.topics && meeting.summary.topics.length > 0 && (
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {meeting.summary.topics.slice(0, 4).map((topic) => (
                <Badge key={topic} variant="secondary">
                  {topic}
                </Badge>
              ))}
              {meeting.summary.topics.length > 4 && (
                <Badge variant="outline">
                  +{meeting.summary.topics.length - 4} more
                </Badge>
              )}
            </div>
          </CardContent>
        )}

        {meeting.video_url && (
          <CardFooter className="pt-0">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <ExternalLink className="h-3 w-3" />
              Video available
            </span>
          </CardFooter>
        )}
      </Card>
    </Link>
  )
}
