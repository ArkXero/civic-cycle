'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface TranscriptFetcherProps {
  meetingId: string
  hasTranscript: boolean
  hasVideoUrl: boolean
}

export function TranscriptFetcher({
  meetingId,
  hasTranscript,
  hasVideoUrl,
}: TranscriptFetcherProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const handleFetch = async (force: boolean = false) => {
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const response = await fetch(`/api/meetings/${meetingId}/fetch-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch transcript')
      }

      setSuccess(true)
      // Force a hard reload to update server component data
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (!hasVideoUrl) {
    return (
      <p className="text-sm text-muted-foreground">
        No YouTube video linked to this meeting.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {!hasTranscript ? (
          <Button onClick={() => handleFetch(false)} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Fetch Transcript from YouTube
              </>
            )}
          </Button>
        ) : (
          <Button variant="outline" onClick={() => handleFetch(true)} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Transcript
              </>
            )}
          </Button>
        )}
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {success && (
        <p className="text-sm text-primary">Transcript fetched successfully!</p>
      )}
    </div>
  )
}
