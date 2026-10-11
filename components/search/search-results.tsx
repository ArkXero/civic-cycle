'use client'

import { MeetingCard } from '@/components/meetings/meeting-card'
import { PaginationControls } from '@/components/meetings/pagination-controls'
import { SearchX } from 'lucide-react'
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

      <div className="border-t-2 border-rule">
        {results.map((meeting) => (
          <MeetingCard key={meeting.id} meeting={meeting} />
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
