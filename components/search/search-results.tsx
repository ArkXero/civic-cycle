'use client'

import { MeetingCard } from '@/components/meetings/meeting-card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, SearchX } from 'lucide-react'
import type { MeetingWithSummary } from '@/types'

interface SearchResultsProps {
  results: MeetingWithSummary[]
  query: string
  currentPage: number
  totalPages: number
  totalCount: number
  onPageChange?: (page: number) => void
}

export function SearchResults({
  results,
  query,
  currentPage,
  totalPages,
  totalCount,
  onPageChange
}: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <SearchX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">No results found</h3>
        <p className="text-muted-foreground">
          No meetings found matching &quot;{query}&quot;. Try different keywords.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-6">
        Found {totalCount} result{totalCount !== 1 ? 's' : ''} for &quot;{query}&quot;
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {results.map((meeting) => (
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
