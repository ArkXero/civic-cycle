'use client'

import { MeetingCard } from './meeting-card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { MeetingWithSummary } from '@/types'

interface MeetingListProps {
  meetings: MeetingWithSummary[]
  currentPage: number
  totalPages: number
  onPageChange?: (page: number) => void
}

export function MeetingList({
  meetings,
  currentPage,
  totalPages,
  onPageChange
}: MeetingListProps) {
  if (meetings.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">No meetings found.</p>
        <p className="text-muted-foreground text-sm mt-2">
          Check back later for new meeting summaries.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {meetings.map((meeting) => (
          <MeetingCard key={meeting.id} meeting={meeting} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange?.(currentPage + 1)}
            disabled={currentPage >= totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  )
}
