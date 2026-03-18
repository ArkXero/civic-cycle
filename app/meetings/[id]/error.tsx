'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function MeetingDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="container mx-auto px-4 py-16 text-center max-w-4xl">
      <div className="flex justify-center mb-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold text-foreground mb-2">
        Failed to load meeting
      </h1>
      <p className="text-muted-foreground mb-6">
        There was a problem fetching this meeting. Please try again.
      </p>
      <div className="flex gap-4 justify-center">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/meetings">All meetings</Link>
        </Button>
      </div>
    </div>
  )
}
