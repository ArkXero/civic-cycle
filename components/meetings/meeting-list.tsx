'use client'

import { MeetingCard } from './meeting-card'
import { PaginationControls } from '@/components/meetings/pagination-controls'
import type { MeetingWithSummary } from '@/types'
import type { MeetingMotionDigest } from '@/lib/data/motions'

interface MeetingListProps {
  meetings: MeetingWithSummary[]
  currentPage: number
  totalPages: number
  digests?: Record<string, MeetingMotionDigest>
  onPageChange?: (page: number) => void
}

export function MeetingList({
  meetings,
  currentPage,
  totalPages,
  digests = {},
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
      <div className="border-t-2 border-rule">
        {meetings.map((meeting) => (
          <MeetingCard key={meeting.id} meeting={meeting} digest={digests[meeting.id]} />
        ))}
      </div>

      {totalPages > 1 && (
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={onPageChange}
        />
      )}
    </div>
  )
}
