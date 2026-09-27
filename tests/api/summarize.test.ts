import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'
import { NextRequest } from 'next/server'

// ─── Mocks ─────────────────────────────────────────────────────────────────
// Must be declared before any imports that use them.

// Mock Supabase clients
const mockAdminFrom = vi.fn()
const mockAdminRpc = vi.fn()
const mockUserFrom = vi.fn()
const mockGetUser = vi.fn()

const USER_ID = '11111111-1111-4111-8111-111111111111'
const MEETING_ID = '55555555-5555-4555-8555-555555555555'

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({ from: mockAdminFrom, rpc: mockAdminRpc }),
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
const MockSummaryGenerationError = vi.hoisted(() => class SummaryGenerationError extends Error {
  constructor(
    message: string,
    public readonly model: string,
    public readonly usage?: { input_tokens: number; output_tokens: number },
    public readonly fallbackEligible = false
  ) {
    super(message)
    this.name = 'SummaryGenerationError'
  }
})

vi.mock('@/lib/anthropic', () => ({
  summarizeMeeting: (...args: unknown[]) => mockSummarizeMeeting(...args),
  chunkTranscript: (...args: unknown[]) => mockChunkTranscript(...args),
  synthesizeChunkSummaries: (...args: unknown[]) => mockSynthesizeChunkSummaries(...args),
  SummaryGenerationError: MockSummaryGenerationError,
}))

// Import the route handler AFTER mocks are set up
import { POST } from '@/app/api/meetings/[id]/summarize/route'
import { trackApiUsage } from '@/lib/track-api-usage'
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
  model: 'claude-haiku-4-5-20251001',
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('POST /api/meetings/[id]/summarize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAdminFrom.mockReset()
    mockAdminRpc.mockReset()
    mockUserFrom.mockReset()
    mockGetUser.mockReset()
    mockSummarizeMeeting.mockReset()
    mockSynthesizeChunkSummaries.mockReset()
    delete process.env.ANTHROPIC_SUMMARY_MODEL
    delete process.env.ANTHROPIC_SUMMARY_FALLBACK_MODEL
    // Default: single chunk
    mockChunkTranscript.mockReturnValue(['transcript content'])
    mockAdminRpc.mockResolvedValue({ data: 1, error: null })
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

  it('returns 400 when transcript_text contains only whitespace', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockAdminFrom.mockReturnValue(makeChain({
      data: {
        id: MEETING_ID,
        title: 'Test',
        transcript_text: ' \n\t ',
        status: 'pending',
        updated_at: new Date().toISOString(),
      },
      error: null,
    }))

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('No transcript')
    expect(mockSummarizeMeeting).not.toHaveBeenCalled()
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

  it('returns 500 when a stuck-processing reset cannot be saved', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockAdminFrom
      .mockReturnValueOnce(makeChain({
        data: {
          id: MEETING_ID,
          title: 'Test',
          transcript_text: 'content',
          status: 'processing',
          updated_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        },
        error: null,
      }))
      .mockReturnValueOnce(makeChain({ data: null, error: new Error('database unavailable') }))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(500)
    expect(mockSummarizeMeeting).not.toHaveBeenCalled()
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
    const noSummaryChain = makeChain({ data: null, error: null })
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
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
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

  it('replaces an existing summary without deleting it first', async () => {
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
    mockSummarizeMeeting.mockResolvedValue(fakeSummary)

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toBe('Summary replaced successfully')
    expect(mockAdminRpc).toHaveBeenCalledOnce()
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
    const noSummaryChain = makeChain({ data: null, error: null })
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

    expect(mockAdminRpc).toHaveBeenCalledWith(
      'replace_meeting_summary',
      expect.objectContaining({ target_meeting_id: MEETING_ID })
    )
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
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: savedSummary, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))

    mockSummarizeMeeting.mockResolvedValue(fakeSummary)

    const { req, params } = makeRequest()
    await POST(req, { params })

    expect(mockSummarizeMeeting).toHaveBeenCalledWith(
      'content',
      'March Board Meeting',
      { model: 'claude-haiku-4-5-20251001', officialMotions: [] }
    )
  })

  it('falls back to Sonnet when primary summary output is fallback eligible', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const meeting = {
      id: MEETING_ID,
      title: 'Fallback Meeting',
      transcript_text: 'content',
      status: 'pending',
      updated_at: new Date().toISOString(),
    }

    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: meeting, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: { id: 'summary-new', ...fakeSummary }, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))

    mockSummarizeMeeting
      .mockRejectedValueOnce(new MockSummaryGenerationError(
        'Failed to parse summary response as JSON',
        'claude-haiku-4-5-20251001',
        { input_tokens: 20, output_tokens: 10 },
        true
      ))
      .mockResolvedValueOnce({
        ...fakeSummary,
        usage: { input_tokens: 100, output_tokens: 50 },
        model: 'claude-sonnet-4-6',
      })

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(200)
    expect(mockSummarizeMeeting).toHaveBeenCalledTimes(2)
    expect(mockSummarizeMeeting.mock.calls[0][2]).toEqual({ model: 'claude-haiku-4-5-20251001', officialMotions: [] })
    expect(mockSummarizeMeeting.mock.calls[1][2]).toEqual({ model: 'claude-sonnet-4-6', officialMotions: [] })
    expect(trackApiUsage).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-haiku-4-5-20251001',
      success: false,
      errorMessage: 'fallback:Failed to parse summary response as JSON',
    }))
    expect(trackApiUsage).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-sonnet-4-6',
      success: true,
    }))
  })

  it('does not fall back when primary summary error is not fallback eligible', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const meeting = {
      id: MEETING_ID,
      title: 'Network Failure Meeting',
      transcript_text: 'content',
      status: 'pending',
      updated_at: new Date().toISOString(),
    }
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: meeting, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))

    mockSummarizeMeeting.mockRejectedValue(new Error('network timeout'))

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(500)
    expect(mockSummarizeMeeting).toHaveBeenCalledTimes(1)
    expect(mockSummarizeMeeting.mock.calls[0][2]).toEqual({ model: 'claude-haiku-4-5-20251001', officialMotions: [] })
    expect(mockAdminRpc).toHaveBeenLastCalledWith('mark_meeting_summary_failure', expect.objectContaining({
      failure_message: 'network timeout',
    }))
  })

  it('marks meeting failed when fallback also fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    const meeting = {
      id: MEETING_ID,
      title: 'Fallback Failure Meeting',
      transcript_text: 'content',
      status: 'pending',
      updated_at: new Date().toISOString(),
    }
    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: meeting, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))

    mockSummarizeMeeting
      .mockRejectedValueOnce(new MockSummaryGenerationError(
        'Failed to parse summary response as JSON',
        'claude-haiku-4-5-20251001',
        { input_tokens: 20, output_tokens: 10 },
        true
      ))
      .mockRejectedValueOnce(new MockSummaryGenerationError(
        'Invalid summary structure returned from Claude: missing_topics',
        'claude-sonnet-4-6',
        { input_tokens: 90, output_tokens: 30 },
        true
      ))

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(500)
    expect(mockSummarizeMeeting).toHaveBeenCalledTimes(2)
    expect(mockAdminRpc).toHaveBeenLastCalledWith('mark_meeting_summary_failure', expect.objectContaining({
      failure_message: expect.stringContaining('Fallback summary failed'),
    }))
    expect(trackApiUsage).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-haiku-4-5-20251001',
      success: false,
    }))
    expect(trackApiUsage).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-sonnet-4-6',
      success: false,
    }))
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

    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: meeting, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
      .mockReturnValueOnce(setProcessingChain)

    mockSummarizeMeeting.mockRejectedValue(new Error('Claude API rate limit'))

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(500)

    expect(mockAdminRpc).toHaveBeenLastCalledWith('mark_meeting_summary_failure', expect.objectContaining({
      failure_message: 'Claude API rate limit',
    }))
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

      mockAdminFrom
        .mockReturnValueOnce(makeChain({ data: meeting, error: null }))
        .mockReturnValueOnce(makeChain({ data: null, error: null }))
        .mockReturnValueOnce(makeChain({ data: null, error: null }))

      mockSummarizeMeeting.mockReturnValue(new Promise(() => {}))

      const { req, params } = makeRequest()
      const resPromise = POST(req, { params })

      await vi.advanceTimersByTimeAsync(120_000)
      const res = await resPromise

      expect(res.status).toBe(500)

      expect(mockAdminRpc).toHaveBeenLastCalledWith('mark_meeting_summary_failure', expect.objectContaining({
        failure_message: 'Claude summary request timed out after 120 seconds',
      }))
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

    mockAdminFrom
      .mockReturnValueOnce(makeChain({ data: meeting, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
      .mockReturnValueOnce(setProcessingChain)

    mockSummarizeMeeting.mockResolvedValue(fakeSummary)
    mockAdminRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB constraint violation' },
    })

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(500)

    expect(mockAdminRpc).toHaveBeenLastCalledWith('mark_meeting_summary_failure', expect.objectContaining({
      failure_message: expect.stringContaining('DB constraint violation'),
    }))
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
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
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
    expect(mockSummarizeMeeting.mock.calls[0][2]).toEqual({ model: 'claude-haiku-4-5-20251001', officialMotions: [] })
    expect(mockSynthesizeChunkSummaries.mock.calls[0][2]).toEqual({ model: 'claude-haiku-4-5-20251001', officialMotions: [] })
    // Chunk summaries synthesized into final output
    expect(mockSynthesizeChunkSummaries).toHaveBeenCalledOnce()
  })

  it('never summarizes a future meeting', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockAdminFrom.mockReturnValueOnce(makeChain({
      data: {
        id: MEETING_ID,
        title: 'Future meeting',
        transcript_text: 'Agenda only',
        status: 'pending',
        updated_at: new Date().toISOString(),
        meeting_date: '2099-01-01',
        source: 'boarddocs',
        boarddocs_content_hash: 'a'.repeat(64),
      },
      error: null,
    }))

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'Awaiting meeting' })
    expect(mockSummarizeMeeting).not.toHaveBeenCalled()
  })

  it('waits for published BoardDocs motion results', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockAdminFrom
      .mockReturnValueOnce(makeChain({
        data: {
          id: MEETING_ID,
          title: 'Completed meeting',
          transcript_text: 'Official agenda content',
          status: 'pending',
          updated_at: new Date().toISOString(),
          meeting_date: '2026-08-20',
          source: 'boarddocs',
          boarddocs_content_hash: 'a'.repeat(64),
        },
        error: null,
      }))
      .mockReturnValueOnce(makeChain({ data: [], error: null }))

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: 'Awaiting results' })
    expect(mockSummarizeMeeting).not.toHaveBeenCalled()
  })

  it('validates BoardDocs summary generation against official motion facts and source hash', async () => {
    const sourceHash = 'a'.repeat(64)
    const motionHash = 'b'.repeat(64)
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
    mockAdminFrom
      .mockReturnValueOnce(makeChain({
        data: {
          id: MEETING_ID,
          title: 'Completed meeting',
          transcript_text: 'Official agenda content',
          status: 'pending',
          updated_at: new Date().toISOString(),
          meeting_date: '2026-08-20',
          source: 'boarddocs',
          boarddocs_content_hash: sourceHash,
        },
        error: null,
      }))
      .mockReturnValueOnce(makeChain({
        data: [{
          id: 'motion-1',
          meeting_id: MEETING_ID,
          agenda_item_id: 'agenda-1',
          source_ordinal: 0,
          content_hash: motionHash,
          raw_html: '<div class="motion">Motion</div>',
          raw_motion_text: 'Main Motion: Adopt policy',
          normalized_motion_text: 'Adopt policy',
          motion_type: 'main',
          parent_ordinal: null,
          is_final: true,
          is_superseded: false,
          outcome: 'passed',
          vote_yes: 9,
          vote_no: 2,
          vote_abstain: null,
          mover: 'Member A',
          seconder: 'Member B',
          roll_call_yes: [],
          roll_call_no: [],
          roll_call_abstain: [],
          parser_version: 'boarddocs-motion-v2',
          created_at: '2026-08-20T00:00:00.000Z',
          updated_at: '2026-08-20T00:00:00.000Z',
        }],
        error: null,
      }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: { id: MEETING_ID }, error: null }))
    mockSummarizeMeeting.mockResolvedValue(fakeSummary)

    const { req, params } = makeRequest()
    const res = await POST(req, { params })

    expect(res.status).toBe(200)
    expect(mockSummarizeMeeting).toHaveBeenCalledWith(
      'Official agenda content',
      'Completed meeting',
      {
        model: 'claude-haiku-4-5-20251001',
        officialMotions: [{
          contentHash: motionHash,
          normalizedText: 'Adopt policy',
          motionType: 'main',
          outcome: 'passed',
          voteYes: 9,
          voteNo: 2,
          voteAbstain: null,
          isFinal: true,
          isSuperseded: false,
        }],
      }
    )
    expect(mockAdminRpc).toHaveBeenCalledWith(
      'replace_meeting_summary',
      expect.objectContaining({ new_source_content_hash: sourceHash })
    )
  })
})
