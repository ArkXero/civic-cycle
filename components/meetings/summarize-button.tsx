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
import { apiCall } from '@/lib/api/fetch'
import type { MeetingStatus } from '@/types'

interface SummarizeButtonProps {
  meetingId: string
  hasSummary: boolean
  hasTranscript: boolean
  status: MeetingStatus
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

  const run = async (method: 'POST' | 'DELETE', onOk: () => void) => {
    setIsLoading(true)
    setError(null)
    try {
      await apiCall(`/api/meetings/${meetingId}/summarize`, { method })
      onOk()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSummarize = () => run('POST', () => window.location.reload())
  const handleDelete = () => run('DELETE', () => router.refresh())

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
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
