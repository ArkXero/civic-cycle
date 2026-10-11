'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PaginationControlsProps {
  currentPage: number
  totalPages: number
  onPageChange?: (page: number) => void
}

export function PaginationControls({ currentPage, totalPages, onPageChange }: PaginationControlsProps) {
  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange?.(currentPage - 1)}
        disabled={currentPage <= 1}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Previous
      </Button>

      {/* Keyed on the page so the box resets to the new page after any navigation. */}
      <PageJump
        key={currentPage}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
      />

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange?.(currentPage + 1)}
        disabled={currentPage >= totalPages}
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </nav>
  )
}

function PageJump({ currentPage, totalPages, onPageChange }: PaginationControlsProps) {
  const [draft, setDraft] = useState(String(currentPage))

  const commit = () => {
    const parsed = Number.parseInt(draft, 10)
    if (Number.isNaN(parsed)) {
      setDraft(String(currentPage))
      return
    }
    const target = Math.min(Math.max(parsed, 1), totalPages)
    setDraft(String(target))
    if (target !== currentPage) onPageChange?.(target)
  }

  return (
    <form
      className="flex items-center gap-2 text-sm text-muted-foreground"
      onSubmit={(event) => {
        event.preventDefault()
        commit()
      }}
    >
      <label htmlFor="page-jump">Page</label>
      <input
        id="page-jump"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/\D/g, ''))}
        onBlur={commit}
        onFocus={(event) => event.target.select()}
        aria-label={`Page number, 1 to ${totalPages}`}
        className="h-8 w-14 rounded-md border border-border bg-background text-center font-mono text-sm text-foreground tabular-nums transition-colors hover:border-foreground/25 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      <span>of {totalPages}</span>
    </form>
  )
}
