'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Loader2, AlertCircle, Calendar, FileText, CheckCircle2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/meetings/status-badge'
import { apiCall } from '@/lib/api/fetch'
import {
  ACTIVE_SCHOOL_DISTRICTS,
  DEFAULT_SCHOOL_DISTRICT_ID,
  getSchoolDistrict,
  isSchoolDistrictId,
  type SchoolDistrictId,
} from '@/lib/school-districts'
import type { MeetingStatus } from '@/types'

type FilterMode = 'all' | 'imported' | 'available'
type RefreshStatus = 'unchanged' | 'awaiting_results' | 'refreshed' | 'refresh_failed'

const REFRESH_LEASE_MS = 15 * 60 * 1000

function hasActiveRefreshLease(startedAt: string | null, now: number) {
  if (!startedAt) return false
  const started = new Date(startedAt).getTime()
  return Number.isFinite(started) && started > now - REFRESH_LEASE_MS
}

interface BoardDocsMeeting {
  id: string
  name: string
  date: string
  numberDate: string
  isImported: boolean
  dbId: string | null
  dbStatus: MeetingStatus | null
  isRegularMeeting: boolean
  boarddocsLastCheckedAt: string | null
  boarddocsResultsSeenAt: string | null
  boarddocsRefreshError: string | null
  boarddocsRefreshStartedAt: string | null
}

interface BoardDocsResponse {
  data: BoardDocsMeeting[]
  importedCount: number
  regularMeetingCount: number
  district: {
    id: SchoolDistrictId
    label: string
    schoolSystemLabel: string
    boardBodyLabel: string
    sourceUrl: string
    regularMeetingFilterDescription: string
  }
}

export function BoardDocsImporter() {
  const [renderedAt] = useState(() => Date.now())
  const [districtId, setDistrictId] = useState<SchoolDistrictId>(DEFAULT_SCHOOL_DISTRICT_ID)
  const [meetings, setMeetings] = useState<BoardDocsMeeting[]>([])
  const [districtMeta, setDistrictMeta] = useState<BoardDocsResponse['district']>(
    {
      id: DEFAULT_SCHOOL_DISTRICT_ID,
      label: getSchoolDistrict(DEFAULT_SCHOOL_DISTRICT_ID).uiLabel,
      schoolSystemLabel: getSchoolDistrict(DEFAULT_SCHOOL_DISTRICT_ID).schoolSystemLabel,
      boardBodyLabel: getSchoolDistrict(DEFAULT_SCHOOL_DISTRICT_ID).boardBodyLabel,
      sourceUrl: getSchoolDistrict(DEFAULT_SCHOOL_DISTRICT_ID).sourceUrl(),
      regularMeetingFilterDescription:
        getSchoolDistrict(DEFAULT_SCHOOL_DISTRICT_ID).regularMeetingFilterDescription,
    }
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [importingId, setImportingId] = useState<string | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{ id: string; status: RefreshStatus } | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')

  const fetchMeetings = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await apiCall<BoardDocsResponse>(
        `/api/boarddocs/districts/${districtId}/meetings`
      )
      setMeetings(data.data)
      setDistrictMeta(data.district)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meetings')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void fetchMeetings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [districtId])

  const handleImport = async (meetingId: string) => {
    setImportingId(meetingId)
    setImportError(null)
    try {
      const data = await apiCall<{
        data?: {
          id: string
          status?: MeetingStatus
          boarddocs_last_checked_at?: string | null
          boarddocs_results_seen_at?: string | null
          boarddocs_refresh_error?: string | null
        }
        refreshStatus: RefreshStatus
        error?: string
      }>(
        `/api/boarddocs/districts/${districtId}/meetings/${meetingId}/import`,
        { method: 'POST' }
      )
      setMeetings((prev) =>
        prev.map((m) =>
          m.id === meetingId
            ? {
                ...m,
                isImported: true,
                dbId: data.data?.id ?? null,
                dbStatus: data.data?.status ?? m.dbStatus ?? 'pending',
                boarddocsLastCheckedAt: data.data?.boarddocs_last_checked_at ?? m.boarddocsLastCheckedAt,
                boarddocsResultsSeenAt: data.data?.boarddocs_results_seen_at ?? m.boarddocsResultsSeenAt,
                boarddocsRefreshError: data.data?.boarddocs_refresh_error ?? data.error ?? null,
              }
            : m
        )
      )
      setLastResult({ id: meetingId, status: data.refreshStatus })
      if (data.refreshStatus === 'refresh_failed') {
        setImportError(data.error ?? 'Refresh failed; previous complete version was preserved')
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImportingId(null)
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
  const regularMeetingCount = meetings.filter((m) => m.isRegularMeeting).length

  const visibleMeetings = meetings.filter((m) => {
    if (filter === 'imported') return m.isImported
    if (filter === 'available') return !m.isImported
    return true
  })

  return (
    <div>
      <div className="flex flex-col gap-4 mb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            value={districtId}
            onValueChange={(value) => {
              if (isSchoolDistrictId(value)) {
                setDistrictId(value)
                setMeetings([])
                setFilter('all')
              }
            }}
          >
            <SelectTrigger className="w-full sm:w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIVE_SCHOOL_DISTRICTS.map((district) => (
                <SelectItem key={district.id} value={district.id}>
                  {district.schoolSystemLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            {meetings.length} meetings found &middot;{' '}
            <span className="text-green-500 font-medium">{importedCount} imported</span>
            {' '}&middot; {availableCount} available &middot; {regularMeetingCount} regular
          </p>
        </div>
        <Button variant="outline" onClick={fetchMeetings} disabled={isLoading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 mb-6 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">{districtMeta.boardBodyLabel}</p>
        <p className="mt-1">{districtMeta.regularMeetingFilterDescription}</p>
      </div>

      <div className="flex gap-2 mb-6">
        {(['all', 'imported', 'available'] as FilterMode[]).map((mode) => (
          <Button
            key={mode}
            size="sm"
            variant={filter === mode ? 'default' : 'outline'}
            onClick={() => setFilter(mode)}
            className="capitalize"
          >
            {mode === 'all' && `All (${meetings.length})`}
            {mode === 'imported' && `Imported (${importedCount})`}
            {mode === 'available' && `Available (${availableCount})`}
          </Button>
        ))}
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
        {visibleMeetings.map((meeting) => {
          const formattedDate = new Date(meeting.date).toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })
          const isImporting = importingId === meeting.id
          const isFuture = new Date(meeting.date).getTime() > renderedAt
          const actionResult = lastResult?.id === meeting.id ? lastResult.status : null

          return (
            <Card key={meeting.id} className="overflow-hidden relative">
              {meeting.isImported && (
                <div className="absolute top-2 right-2 z-10">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
              )}
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="font-medium text-sm line-clamp-2 pr-6" title={meeting.name}>
                    {meeting.name}
                  </h3>
                  {meeting.dbStatus && (
                    <div className="shrink-0">
                      <StatusBadge status={meeting.dbStatus} />
                    </div>
                  )}
                </div>
                {!meeting.isRegularMeeting && (
                  <div className="mb-3 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">
                    Not matched by cron regular-meeting filter
                  </div>
                )}
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

                {meeting.boarddocsLastCheckedAt && (
                  <p className="mb-3 text-xs text-muted-foreground">
                    Last checked {new Date(meeting.boarddocsLastCheckedAt).toLocaleString()}
                  </p>
                )}
                {meeting.boarddocsRefreshError && (
                  <p className="mb-3 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive" role="alert">
                    {meeting.boarddocsRefreshError}
                  </p>
                )}
                {actionResult && actionResult !== 'refresh_failed' && (
                  <p className="mb-3 rounded-md bg-muted px-2 py-1.5 text-xs text-muted-foreground" aria-live="polite">
                    {actionResult === 'unchanged' && 'Official content unchanged; AI skipped.'}
                    {actionResult === 'awaiting_results' && 'Agenda saved; awaiting official results.'}
                    {actionResult === 'refreshed' && 'Official content and summary refreshed.'}
                  </p>
                )}

                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    className="w-full"
                    variant={meeting.isImported ? 'outline' : 'default'}
                    onClick={() => handleImport(meeting.id)}
                    disabled={isImporting || hasActiveRefreshLease(meeting.boarddocsRefreshStartedAt, renderedAt)}
                  >
                    {isImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Refreshing...
                      </>
                    ) : meeting.isImported ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Refresh from BoardDocs
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        {isFuture ? 'Import Agenda' : 'Import from BoardDocs'}
                      </>
                    )}
                  </Button>
                  {meeting.isImported && meeting.dbId && (
                    <Button size="sm" variant="ghost" className="w-full" asChild>
                      <a href={`/meetings/${meeting.dbId}`}>View Meeting</a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {visibleMeetings.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {filter === 'imported' ? 'No meetings imported yet.' :
             filter === 'available' ? 'All meetings have been imported.' :
             'No meetings found on BoardDocs.'}
          </p>
        </div>
      )}
    </div>
  )
}
