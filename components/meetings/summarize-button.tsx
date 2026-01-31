'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface SummarizeButtonProps {
  meetingId: string
  hasSummary: boolean
  hasTranscript: boolean
  status: string
}

export function SummarizeButton({
  meetingId,
  hasSummary,
  hasTranscript,
  status,
}: SummarizeButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSummarize = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/meetings/${meetingId}/summarize`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate summary')
      }

      // Force a hard reload to update server component data
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/meetings/${meetingId}/summarize`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete summary')
      }

      // Refresh the page
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (!hasTranscript) {
    return (
      <div className="text-sm text-muted-foreground">
        No transcript available for summarization
      </div>
    )
  }

  if (status === 'processing') {
    return (
      <Button disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Processing...
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {!hasSummary ? (
          <Button onClick={handleSummarize} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate AI Summary
              </>
            )}
          </Button>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={isLoading}>
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Regenerate Summary
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Regenerate Summary?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will delete the existing summary and generate a new one using AI.
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    await handleDelete()
                    await handleSummarize()
                  }}
                >
                  Regenerate
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
