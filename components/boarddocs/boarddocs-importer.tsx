'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Loader2, AlertCircle, Calendar, FileText, Check, Download, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface BoardDocsMeeting {
  id: string
  name: string
  date: string
  numberDate: string
  isImported: boolean
  dbId: string | null
  dbStatus: string | null
}

export function BoardDocsImporter() {
  const [meetings, setMeetings] = useState<BoardDocsMeeting[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [summarizingId, setSummarizingId] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const fetchMeetings = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/boarddocs/meetings')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch meetings')
      }

      setMeetings(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meetings')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchMeetings()
  }, [])

  const handleImport = async (meetingId: string) => {
    setImportingId(meetingId)
    setImportError(null)

    try {
      const response = await fetch(`/api/boarddocs/meetings/${meetingId}/import`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to import meeting')
      }

      // Update local state with DB id and status
      setMeetings((prev) =>
        prev.map((m) =>
          m.id === meetingId
            ? { ...m, isImported: true, dbId: data.data?.id ?? null, dbStatus: 'pending' }
            : m
        )
      )
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImportingId(null)
    }
  }

  const handleSummarize = async (boardDocsId: string, dbId: string) => {
    setSummarizingId(boardDocsId)
    setImportError(null)

    try {
      const response = await fetch(`/api/meetings/${dbId}/summarize`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to generate summary')
      }

      // Update status to summarized
      setMeetings((prev) =>
        prev.map((m) =>
          m.id === boardDocsId ? { ...m, dbStatus: 'summarized' } : m
        )
      )
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Summary generation failed')
      // Refresh to get actual status from DB
      fetchMeetings()
    } finally {
      setSummarizingId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Loading meetings from BoardDocs...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium mb-2">Failed to load meetings</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchMeetings}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    )
  }

  const importedCount = meetings.filter((m) => m.isImported).length
  const availableCount = meetings.length - importedCount

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-muted-foreground">
            {meetings.length} meetings found &middot; {importedCount} imported &middot; {availableCount} available
          </p>
        </div>
        <Button variant="outline" onClick={fetchMeetings} disabled={isLoading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {importError && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{importError}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {meetings.map((meeting) => {
          const formattedDate = new Date(meeting.date).toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
          const isImporting = importingId === meeting.id
          const isSummarizing = summarizingId === meeting.id
          const canSummarize =
            meeting.isImported &&
            meeting.dbId &&
            (meeting.dbStatus === 'pending' || meeting.dbStatus === 'failed')

          return (
            <Card key={meeting.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-medium text-sm line-clamp-2" title={meeting.name}>
                    {meeting.name}
                  </h3>
                  <div className="flex flex-col gap-1 shrink-0">
                    {meeting.isImported && (
                      <Badge className="bg-primary text-primary-foreground">
                        <Check className="h-3 w-3 mr-1" />
                        Imported
                      </Badge>
                    )}
                    {meeting.dbStatus && (
                      <StatusBadge status={meeting.dbStatus} />
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formattedDate}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Agenda
                  </span>
                </div>

                {!meeting.isImported ? (
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => handleImport(meeting.id)}
                    disabled={isImporting}
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Import
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="flex flex-col gap-2">
                    {meeting.dbStatus === 'summarized' ? (
                      <Button size="sm" variant="outline" className="w-full" asChild>
                        <a href={`/meetings/${meeting.dbId}`}>View Summary</a>
                      </Button>
                    ) : canSummarize ? (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleSummarize(meeting.id, meeting.dbId!)}
                        disabled={isSummarizing}
                      >
                        {isSummarizing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Generate Summary
                          </>
                        )}
                      </Button>
                    ) : meeting.dbStatus === 'processing' ? (
                      <Button size="sm" className="w-full" disabled>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" className="w-full" asChild>
                      <a href={`/meetings/${meeting.dbId}`}>View Meeting</a>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {meetings.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No meetings found on BoardDocs.</p>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return <Badge variant="secondary">Pending</Badge>
    case 'processing':
      return <Badge variant="outline" className="text-yellow-600 border-yellow-600">Processing</Badge>
    case 'summarized':
      return <Badge className="bg-green-600 text-white">Summarized</Badge>
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>
    default:
      return null
  }
}
