'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { SearchResults } from '@/components/search/search-results'
import type { MeetingWithSummary } from '@/types'

interface SearchResultsClientProps {
  initialResults: MeetingWithSummary[]
  initialQuery: string
  initialPage: number
  initialTotalPages: number
  initialTotalCount: number
}

export function SearchResultsClient({
  initialResults,
  initialQuery,
  initialPage,
  initialTotalPages,
  initialTotalCount
}: SearchResultsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(newPage))
    router.push(`/search?${params.toString()}`)
  }

  return (
    <SearchResults
      results={initialResults}
      query={initialQuery}
      currentPage={initialPage}
      totalPages={initialTotalPages}
      totalCount={initialTotalCount}
      onPageChange={handlePageChange}
    />
  )
}
