'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { MeetingList } from '@/components/meetings/meeting-list'
import type { MeetingWithSummary } from '@/types'

interface MeetingListClientProps {
  initialMeetings: MeetingWithSummary[]
  initialPage: number
  initialTotalPages: number
  initialBody?: string
}

export function MeetingListClient({
  initialMeetings,
  initialPage,
  initialTotalPages,
  initialBody
}: MeetingListClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(newPage))
    router.push(`/meetings?${params.toString()}`)
  }

  return (
    <MeetingList
      meetings={initialMeetings}
      currentPage={initialPage}
      totalPages={initialTotalPages}
      onPageChange={handlePageChange}
    />
  )
}
