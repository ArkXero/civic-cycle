'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MEETING_BODIES } from '@/lib/constants'

interface MeetingFiltersProps {
  currentBody?: string
}

export function MeetingFilters({ currentBody }: MeetingFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleBodyChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())

    if (value === 'all') {
      params.delete('body')
    } else {
      params.set('body', value)
    }

    // Reset to page 1 when filter changes
    params.delete('page')

    router.push(`/meetings?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-4 items-center">
      <div className="flex items-center gap-2">
        <label htmlFor="body-filter" className="text-sm font-medium text-muted-foreground">
          Filter by:
        </label>
        <Select
          value={currentBody || 'all'}
          onValueChange={handleBodyChange}
        >
          <SelectTrigger id="body-filter" className="w-[200px]">
            <SelectValue placeholder="All meeting bodies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All meeting bodies</SelectItem>
            {MEETING_BODIES.map((body) => (
              <SelectItem key={body} value={body}>
                {body}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
