import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { NextRequest } from 'next/server'

// ─── Mocks ─────────────────────────────────────────────────────────────────
// Must be declared before any imports that use them.

// Mock Supabase clients
const mockAdminFrom = vi.fn()
const mockUserFrom = vi.fn()
const mockGetUser = vi.fn()

const USER_ID = '11111111-1111-4111-8111-111111111111'
const MEETING_ID = '55555555-5555-4555-8555-555555555555'

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ from: mockAdminFrom }),
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockUserFrom,
  }),
}))

// Mock admin check — all non-401 tests assume the user is an admin
vi.mock('@/lib/auth/is-admin-server', () => ({
  isAdminUser: vi.fn().mockResolvedValue(true),
}))

// Mock activity and API-usage trackers so they don't need a real DB
vi.mock('@/lib/activity', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
  ActivityTypes: {
    SUMMARY_GENERATED: 'summary_generated',
    SUMMARY_FAILED: 'summary_failed',
  },
}))
vi.mock('@/lib/track-api-usage', () => ({
  trackApiUsage: vi.fn().mockResolvedValue(undefined),
}))

// Mock Anthropic lib
const mockSummarizeMeeting = vi.fn()
const mockChunkTranscript = vi.fn()
const mockSynthesizeChunkSummaries = vi.fn()

vi.mock('@/lib/anthropic', () => ({
  summarizeMeeting: (...args: unknown[]) => mockSummarizeMeeting(...args),
  chunkTranscript: (...args: unknown[]) => mockChunkTranscript(...args),
  synthesizeChunkSummaries: (...args: unknown[]) => mockSynthesizeChunkSummaries(...args),
}))

// Import the route handler AFTER mocks are set up
import { POST } from '@/app/api/meetings/[id]/summarize/route'
import { makeChain } from '../helpers/supabase-chain'

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeRequest(id = MEETING_ID, search = '') {
  const req = new NextRequest(`http://localhost/api/meetings/${id}/summarize${search}`, {
    method: 'POST',
  })
  return { req, params: Promise.resolve({ id }) }
}

/** A valid AI SummarizeResult (wrapped summary + usage) */
const fakeSummary = {
  summary: {
    summary_text: 'Board approved the FY2026 budget.',
    topics: ['Budget'],
    key_decisions: [{ decision: 'Budget approved', context: 'After review' }],
    action_items: [{ item: 'Publish budget', responsible_party: 'CFO', deadline: null }],
    sentiment: 'neutral',
  },
  usage: { input_tokens: 100, output_tokens: 50 },
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('POST /api/meetings/[id]/summarize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: single chunk
    mockChunkTranscript.mockReturnValue(['transcript content'])
  })

  // ── Auth ──────────────────────────────────────────────────────────────────

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when getUser returns an error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('auth error') })

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(401)
  })

  // ── Meeting lookup ────────────────────────────────────────────────────────

  it('returns 404 when meeting does not exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockAdminFrom.mockReturnValue(makeChain({ data: null, error: new Error('not found') }))

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Not found')
  })

  // ── No transcript ─────────────────────────────────────────────────────────

  it('returns 400 when meeting has no transcript_text', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const meeting = { id: MEETING_ID, title: 'Test', transcript_text: null, status: 'pending', updated_at: new Date().toISOString() }
    mockAdminFrom.mockReturnValue(makeChain({ data: meeting, error: null }))

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('No transcript')
  })

  // ── Processing guard ──────────────────────────────────────────────────────

  it('returns 409 when meeting is already processing and not stuck', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const recentTime = new Date(Date.now() - 2 * 60 * 1000).toISOString() // 2 min ago
    const meeting = {
      id: MEETING_ID,
      title: 'Test',
      transcript_text: 'content',
      status: 'processing',
      updated_at: recentTime,
    }
    mockAdminFrom.mockReturnValue(makeChain({ data: meeting, error: null }))

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('Processing')
  })

  it('resets a stuck processing meeting and continues to summarize', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const stuckTime = new Date(Date.now() - 15 * 60 * 1000).toISOString() // 15 min ago
    const meeting = {
      id: MEETING_ID,
      title: 'Test',
      transcript_text: 'content',
      status: 'processing',
      updated_at: stuckTime,
    }
    const savedSummary = { id: 'summary-1', ...fakeSummary }

    // Sequence of adminFrom calls:
    // 1. fetch meeting → stuck processing
    // 2. reset to pending
    // 3. check existing summary → none
    // 4. set processing
    // 5. insert summary → success
    // 6. set summarized
    const fetchChain = makeChain({ data: meeting, error: null })
    const resetChain = makeChain({ data: null, error: null })
    const noSummaryChain = makeChain({ data: null, error: new Error('no rows') })
    const setProcessingChain = makeChain({ data: null, error: null })
    const insertChain = makeChain({ data: savedSummary, error: null })
    const setSummarizedChain = makeChain({ data: null, error: null })

    mockAdminFrom
      .mockReturnValueOnce(fetchChain)
      .mockReturnValueOnce(resetChain)
      .mockReturnValueOnce(noSummaryChain)
      .mockReturnValueOnce(setProcessingChain)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(setSummarizedChain)

    mockSummarizeMeeting.mockResolvedValue(fakeSummary)

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe('Summary generated successfully')
  })

  it('force-resets a recently processing meeting and continues to summarize', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const recentTime = new Date(Date.now() - 30 * 1000).toISOString()
    const meeting = {
      id: MEETING_ID,
      title: 'Test',
      transcript_text: 'content',
      status: 'processing',
      updated_at: recentTime,
    }
    const resetChain = makeChain({ data: null, error: null })

    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: meeting, error: null }))
      .mockReturnValueOnce(resetChain)
      .mockReturnValueOnce(makeChain({ data: null, error: new Error('no rows') }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: { id: 'summary-1', ...fakeSummary }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))

    mockSummarizeMeeting.mockResolvedValue(fakeSummary)

    const { req, params } = makeRequest(MEETING_ID, '?force=true')
    const res = await POST(req, { params })

    expect(res.status).toBe(200)
    expect(resetChain.update).toHaveBeenCalledWith({ status: 'pending', error_message: null })
  })

  // ── Already summarized ────────────────────────────────────────────────────

  it('returns 409 when summary already exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const meeting = {
      id: MEETING_ID,
      title: 'Test',
      transcript_text: 'content',
      status: 'pending',
      updated_at: new Date().toISOString(),
    }
    const existingSummary = { id: 'summary-existing' }

    // 1. fetch meeting, 2. check summaries (exists)
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: meeting, error: null }))
      .mockReturnValueOnce(makeChain({ data: existingSummary, error: null }))

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('Already summarized')
  })

  // ── Happy path ────────────────────────────────────────────────────────────

  it('generates summary, saves it, and sets status to summarized', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const meeting = {
      id: MEETING_ID,
      title: 'March Board Meeting',
      transcript_text: 'The board discussed the budget...',
      status: 'pending',
      updated_at: new Date().toISOString(),
    }
    const savedSummary = { id: 'summary-new', meeting_id: MEETING_ID, ...fakeSummary }

    // 1. fetch meeting
    // 2. check existing summary → none
    // 3. set processing
    // 4. insert summary
    // 5. set summarized
    const noSummaryChain = makeChain({ data: null, error: new Error('no rows') })
    const setProcessingChain = makeChain({ data: null, error: null })
    const insertChain = makeChain({ data: savedSummary, error: null })
    const setSummarizedChain = makeChain({ data: null, error: null })

    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: meeting, error: null }))
      .mockReturnValueOnce(noSummaryChain)
      .mockReturnValueOnce(setProcessingChain)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(setSummarizedChain)

    mockSummarizeMeeting.mockResolvedValue(fakeSummary)

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe('Summary generated successfully')

    // Verify the final status update was 'summarized'
    const lastUpdateCall = setSummarizedChain.update.mock.calls[0][0]
    expect(lastUpdateCall).toMatchObject({ status: 'summarized' })
  })

  it('passes the meeting title to summarizeMeeting', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const meeting = {
      id: MEETING_ID,
      title: 'March Board Meeting',
      transcript_text: 'content',
      status: 'pending',
      updated_at: new Date().toISOString(),
    }
    const savedSummary = { id: 'summary-new', ...fakeSummary }

    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: meeting, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: new Error('no rows') }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: savedSummary, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))

    mockSummarizeMeeting.mockResolvedValue(fakeSummary)

    const { req, params } = makeRequest()
    await POST(req, { params })

    expect(mockSummarizeMeeting).toHaveBeenCalledWith(
      'content',
      'March Board Meeting'
    )
  })

  // ── Failure handling ──────────────────────────────────────────────────────

  it('sets status to failed with error_message when AI throws', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const meeting = {
      id: MEETING_ID,
      title: 'Test',
      transcript_text: 'content',
      status: 'pending',
      updated_at: new Date().toISOString(),
    }

    const setProcessingChain = makeChain({ data: null, error: null })
    const setFailedChain = makeChain({ data: null, error: null })

    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: meeting, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: new Error('no rows') }))
      .mockReturnValueOnce(setProcessingChain)
      .mockReturnValueOnce(setFailedChain)

    mockSummarizeMeeting.mockRejectedValue(new Error('Claude API rate limit'))

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(500)

    // Verify failed status update with error_message
    const failedUpdate = setFailedChain.update.mock.calls[0][0]
    expect(failedUpdate.status).toBe('failed')
    expect(failedUpdate.error_message).toBe('Claude API rate limit')
  })

  it('sets status to failed with error_message when Claude times out', async () => {
    vi.useFakeTimers()

    try {
      mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

      const meeting = {
        id: MEETING_ID,
        title: 'Test',
        transcript_text: 'content',
        status: 'pending',
        updated_at: new Date().toISOString(),
      }

      const setFailedChain = makeChain({ data: null, error: null })

      mockAdminFrom
        .mockReturnValueOnce(makeChain({ data: meeting, error: null }))
        .mockReturnValueOnce(makeChain({ data: null, error: new Error('no rows') }))
        .mockReturnValueOnce(makeChain({ data: null, error: null }))
        .mockReturnValueOnce(setFailedChain)

      mockSummarizeMeeting.mockReturnValue(new Promise(() => {}))

      const { req, params } = makeRequest()
      const resPromise = POST(req, { params })

      await vi.advanceTimersByTimeAsync(120_000)
      const res = await resPromise

      expect(res.status).toBe(500)

      const failedUpdate = setFailedChain.update.mock.calls[0][0]
      expect(failedUpdate.status).toBe('failed')
      expect(failedUpdate.error_message).toBe('Claude summary request timed out after 120 seconds')
    } finally {
      vi.useRealTimers()
    }
  })

  it('sets status to failed when summary save throws', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const meeting = {
      id: MEETING_ID,
      title: 'Test',
      transcript_text: 'content',
      status: 'pending',
      updated_at: new Date().toISOString(),
    }

    const setProcessingChain = makeChain({ data: null, error: null })
    const insertChain = makeChain({ data: null, error: { message: 'DB constraint violation' } })
    const setFailedChain = makeChain({ data: null, error: null })

    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: meeting, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: new Error('no rows') }))
      .mockReturnValueOnce(setProcessingChain)
      .mockReturnValueOnce(insertChain)
      .mockReturnValueOnce(setFailedChain)

    mockSummarizeMeeting.mockResolvedValue(fakeSummary)

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(500)

    const failedUpdate = setFailedChain.update.mock.calls[0][0]
    expect(failedUpdate.status).toBe('failed')
    expect(failedUpdate.error_message).toContain('DB constraint violation')
  })

  // ── Multi-chunk ───────────────────────────────────────────────────────────

  it('summarizes all chunks via map-reduce when transcript is chunked', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const meeting = {
      id: MEETING_ID,
      title: 'Long Meeting',
      transcript_text: 'very long transcript',
      status: 'pending',
      updated_at: new Date().toISOString(),
    }
    const savedSummary = { id: 'summary-new', ...fakeSummary }

    mockChunkTranscript.mockReturnValue(['chunk-one', 'chunk-two', 'chunk-three'])

    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: meeting, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: new Error('no rows') }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: savedSummary, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))

    mockSummarizeMeeting.mockResolvedValue(fakeSummary)
    mockSynthesizeChunkSummaries.mockResolvedValue(fakeSummary)

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(200)
    // Each chunk summarized independently
    expect(mockSummarizeMeeting).toHaveBeenCalledTimes(3)
    expect(mockSummarizeMeeting.mock.calls[0][0]).toBe('chunk-one')
    expect(mockSummarizeMeeting.mock.calls[1][0]).toBe('chunk-two')
    expect(mockSummarizeMeeting.mock.calls[2][0]).toBe('chunk-three')
    // Chunk summaries synthesized into final output
    expect(mockSynthesizeChunkSummaries).toHaveBeenCalledOnce()
  })
})
