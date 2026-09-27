import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { makeChain } from '../helpers/supabase-chain'

const mockGetMeetingContent = vi.fn()
const mockPersistMeetingIngestion = vi.fn()
const mockRunSummarize = vi.fn()

vi.mock('@/lib/boarddocs', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/boarddocs')>()
  return {
    ...original,
    getMeetingContent: (...args: unknown[]) => mockGetMeetingContent(...args),
  }
})

vi.mock('@/lib/meeting-ingestion', () => ({
  attachmentIngestionEnabled: () => false,
  persistMeetingIngestion: (...args: unknown[]) => mockPersistMeetingIngestion(...args),
}))

vi.mock('@/lib/run-summarize', () => ({
  runSummarize: (...args: unknown[]) => mockRunSummarize(...args),
}))

import {
  isFutureBoardDocsMeeting,
  refreshBoardDocsMeeting,
  shouldPollBoardDocsResults,
} from '@/lib/boarddocs-refresh'

const meeting = {
  id: 'BOARD-DOCS-1',
  name: 'Regular Meeting',
  date: new Date('2026-08-20T12:00:00.000Z'),
  numberDate: '20260820',
  unid: 'UNID',
}

function content(overrides: Record<string, unknown> = {}) {
  return {
    title: meeting.name,
    date: meeting.date,
    fullText: 'Official content',
    itemCount: 1,
    documentCount: 0,
    agendaItems: [],
    expectedItemCount: 1,
    complete: true,
    fetchErrors: [],
    hasOfficialResults: true,
    contentHash: 'b'.repeat(64),
    ...overrides,
  }
}

function existing(overrides: Record<string, unknown> = {}) {
  return {
    id: 'meeting-1',
    status: 'summarized',
    boarddocs_content_hash: 'a'.repeat(64),
    boarddocs_results_seen_at: '2026-08-20T20:00:00.000Z',
    summaries: [{ source_content_hash: 'a'.repeat(64) }],
    ...overrides,
  }
}

function admin(
  row = existing(),
  token: string | null = 'refresh-token',
  extraChains: ReturnType<typeof makeChain>[] = []
) {
  const upsert = makeChain({ data: null, error: null })
  const lookup = makeChain({ data: row, error: null })
  const from = vi.fn()
    .mockReturnValueOnce(upsert)
    .mockReturnValueOnce(lookup)
  for (const chain of extraChains) from.mockReturnValueOnce(chain)
  const rpc = vi.fn().mockResolvedValue({ data: token, error: null })
  return { client: { from, rpc } as never, from, rpc, upsert, lookup }
}

function successfulRelease() {
  return makeChain({ data: { id: 'meeting-1' }, error: null })
}

describe('BoardDocs refresh lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPersistMeetingIngestion.mockResolvedValue(undefined)
    mockRunSummarize.mockResolvedValue({ revision: 2, replacedExisting: true })
  })

  it('uses configurable delayed-results grace window', () => {
    process.env.BOARDDOCS_RESULTS_GRACE_DAYS = '14'
    const now = new Date('2026-08-28T12:00:00.000Z')

    expect(shouldPollBoardDocsResults(new Date('2026-08-20T12:00:00.000Z'), 'America/New_York', now)).toBe(true)
    expect(shouldPollBoardDocsResults(new Date('2026-08-01T12:00:00.000Z'), 'America/New_York', now)).toBe(false)
    expect(shouldPollBoardDocsResults(new Date('2026-09-01T12:00:00.000Z'), 'America/New_York', now)).toBe(false)
    delete process.env.BOARDDOCS_RESULTS_GRACE_DAYS
  })

  it('keeps polling through the final grace calendar day', () => {
    process.env.BOARDDOCS_RESULTS_GRACE_DAYS = '14'
    const now = new Date('2026-08-28T23:59:59.000Z')

    expect(shouldPollBoardDocsResults(new Date('2026-08-14T12:00:00.000Z'), 'America/New_York', now)).toBe(true)
    delete process.env.BOARDDOCS_RESULTS_GRACE_DAYS
  })

  it('uses the district calendar when checking future BoardDocs meetings', () => {
    expect(isFutureBoardDocsMeeting(
      new Date('2026-08-29T12:00:00.000Z'),
      'America/New_York',
      new Date('2026-08-29T01:30:00.000Z')
    )).toBe(true)
  })

  it('imports future agenda without transcript or AI summary', async () => {
    const metadataUpdate = successfulRelease()
    const release = successfulRelease()
    const database = admin(existing({ boarddocs_content_hash: null, boarddocs_results_seen_at: null }), 'token', [
      metadataUpdate,
      release,
    ])
    mockGetMeetingContent.mockResolvedValue(content({
      date: new Date('2099-01-01T12:00:00.000Z'),
      hasOfficialResults: false,
    }))

    const result = await refreshBoardDocsMeeting(database.client, 'fairfax', {
      ...meeting,
      date: new Date('2099-01-01T12:00:00.000Z'),
    })

    expect(result.status).toBe('awaiting_results')
    expect(mockPersistMeetingIngestion).toHaveBeenCalledOnce()
    expect(mockPersistMeetingIngestion).toHaveBeenCalledWith(
      database.client,
      'meeting-1',
      'token',
      expect.anything(),
      expect.objectContaining({ meetingDate: '2099-01-01', transcript: null })
    )
    expect(mockRunSummarize).not.toHaveBeenCalled()
    expect(metadataUpdate.update.mock.calls[0][0]).not.toHaveProperty('transcript_text')
  })

  it('keeps polling completed meeting while results are delayed', async () => {
    const metadataUpdate = successfulRelease()
    const release = successfulRelease()
    const database = admin(existing({ boarddocs_content_hash: null, boarddocs_results_seen_at: null }), 'token', [
      metadataUpdate,
      release,
    ])
    mockGetMeetingContent.mockResolvedValue(content({ hasOfficialResults: false }))

    const result = await refreshBoardDocsMeeting(database.client, 'fairfax', meeting)

    expect(result.status).toBe('awaiting_results')
    expect(mockRunSummarize).not.toHaveBeenCalled()
  })

  it('skips persistence and AI when source hash is unchanged', async () => {
    const release = successfulRelease()
    const database = admin(existing({
      boarddocs_content_hash: 'b'.repeat(64),
      summaries: [{ source_content_hash: 'b'.repeat(64) }],
    }), 'token', [release])
    mockGetMeetingContent.mockResolvedValue(content())

    const result = await refreshBoardDocsMeeting(database.client, 'fairfax', meeting)

    expect(result.status).toBe('unchanged')
    expect(mockPersistMeetingIngestion).not.toHaveBeenCalled()
    expect(mockRunSummarize).not.toHaveBeenCalled()
  })

  it('retries a failed replacement when source hash is unchanged but summary hash is stale', async () => {
    const release = successfulRelease()
    const database = admin(existing({
      boarddocs_content_hash: 'b'.repeat(64),
      summaries: [{ source_content_hash: 'a'.repeat(64) }],
    }), 'token', [release])
    mockGetMeetingContent.mockResolvedValue(content())

    const result = await refreshBoardDocsMeeting(database.client, 'fairfax', meeting)

    expect(result).toMatchObject({ status: 'refreshed', summaryRevision: 2 })
    expect(mockPersistMeetingIngestion).not.toHaveBeenCalled()
    expect(mockRunSummarize).toHaveBeenCalledOnce()
    expect(mockRunSummarize).toHaveBeenCalledWith(
      'meeting-1',
      'Official content',
      'Regular Meeting',
      database.client,
      expect.objectContaining({ refreshToken: 'token' })
    )
  })

  it('rejects partial fetch and preserves previous complete hash', async () => {
    const release = successfulRelease()
    const database = admin(existing(), 'token', [release])
    mockGetMeetingContent.mockResolvedValue(content({
      complete: false,
      itemCount: 3,
      expectedItemCount: 5,
      fetchErrors: ['ITEM-4: timeout'],
    }))

    const result = await refreshBoardDocsMeeting(database.client, 'fairfax', meeting)

    expect(result).toMatchObject({
      status: 'refresh_failed',
      contentHash: 'a'.repeat(64),
    })
    expect(result.error).toContain('Partial BoardDocs fetch: 3/5')
    expect(mockPersistMeetingIngestion).not.toHaveBeenCalled()
    expect(mockRunSummarize).not.toHaveBeenCalled()
  })

  it('preserves agenda data when BoardDocs unexpectedly returns no items', async () => {
    const release = successfulRelease()
    const database = admin(existing({ boarddocs_content_hash: null }), 'token', [release])
    mockGetMeetingContent.mockResolvedValue(content({
      agendaItems: [],
      itemCount: 0,
      expectedItemCount: 0,
      contentHash: 'c'.repeat(64),
    }))

    const result = await refreshBoardDocsMeeting(database.client, 'fairfax', meeting)

    expect(result).toMatchObject({ status: 'refresh_failed', contentHash: null })
    expect(result.error).toContain('omitted the existing agenda')
    expect(mockPersistMeetingIngestion).not.toHaveBeenCalled()
  })

  it('returns immediately when another cron or manual refresh owns lease', async () => {
    const database = admin(existing(), null)

    const result = await refreshBoardDocsMeeting(database.client, 'fairfax', meeting)

    expect(result).toMatchObject({
      status: 'refresh_failed',
      error: 'Refresh already in progress',
    })
    expect(mockGetMeetingContent).not.toHaveBeenCalled()
  })

  it('reports failure when the refresh lease is lost before release', async () => {
    const lostRelease = makeChain({ data: null, error: null })
    const database = admin(existing({
      boarddocs_content_hash: 'b'.repeat(64),
      summaries: [{ source_content_hash: 'b'.repeat(64) }],
    }), 'token', [lostRelease])
    mockGetMeetingContent.mockResolvedValue(content())

    const result = await refreshBoardDocsMeeting(database.client, 'fairfax', meeting)

    expect(result).toMatchObject({
      status: 'refresh_failed',
      error: 'BoardDocs refresh lease was lost',
    })
    expect(database.from).toHaveBeenCalledTimes(3)
  })

  it('refreshes changed official source without resetting alert or digest dedupe', async () => {
    const metadataUpdate = successfulRelease()
    const release = successfulRelease()
    const database = admin(existing(), 'token', [metadataUpdate, release])
    mockGetMeetingContent.mockResolvedValue(content())

    const result = await refreshBoardDocsMeeting(database.client, 'fairfax', meeting)

    expect(result).toMatchObject({ status: 'refreshed', summaryRevision: 2 })
    expect(mockRunSummarize).toHaveBeenCalledOnce()
    expect(mockRunSummarize).toHaveBeenCalledWith(
      'meeting-1',
      'Official content',
      'Regular Meeting',
      database.client,
      expect.objectContaining({ refreshToken: 'token' })
    )
    const update = metadataUpdate.update.mock.calls[0][0]
    expect(update).not.toHaveProperty('digest_sent')
    expect(update).not.toHaveProperty('digest_sent_at')
  })
})
