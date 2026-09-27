import { beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { makeChain } from '../helpers/supabase-chain'

const mockSummarizeMeeting = vi.fn()
const mockChunkTranscript = vi.fn()

vi.mock('@/lib/anthropic', () => ({
  summarizeMeeting: (...args: unknown[]) => mockSummarizeMeeting(...args),
  synthesizeChunkSummaries: vi.fn(),
  chunkTranscript: (...args: unknown[]) => mockChunkTranscript(...args),
  SummaryGenerationError: class SummaryGenerationError extends Error {},
}))

vi.mock('@/lib/activity', () => ({
  logActivity: vi.fn().mockResolvedValue(undefined),
  ActivityTypes: { SUMMARY_GENERATED: 'generated', SUMMARY_FAILED: 'failed' },
}))

vi.mock('@/lib/track-api-usage', () => ({
  trackApiUsage: vi.fn().mockResolvedValue(undefined),
}))

import { runSummarize, SUMMARY_SCHEMA_VERSION } from '@/lib/run-summarize'

const summaryResult = {
  summary: {
    summary_text: 'Summary',
    topics: ['Policy'],
    key_decisions: [{
      decision: 'Adopt policy',
      source_motion_hash: null,
      motion_type: null,
      outcome: null,
      vote_yes: null,
      vote_no: null,
      vote_abstain: null,
    }],
    action_items: [],
    sentiment: 'neutral' as const,
  },
  usage: { input_tokens: 10, output_tokens: 5 },
  model: 'claude-haiku-4-5-20251001',
}

function adminClient(from: ReturnType<typeof vi.fn>, rpc: ReturnType<typeof vi.fn>) {
  return { from, rpc } as never
}

describe('runSummarize replacement lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChunkTranscript.mockReturnValue(['Transcript'])
    mockSummarizeMeeting.mockResolvedValue(summaryResult)
  })

  it('atomically creates a first summary through the replacement RPC', async () => {
    const from = vi.fn()
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
    const rpc = vi.fn().mockResolvedValue({ data: 1, error: null })

    const result = await runSummarize('meeting-1', 'Transcript', 'Meeting', adminClient(from, rpc), {
      sourceContentHash: 'a'.repeat(64),
    })

    expect(result).toEqual({ revision: 1, replacedExisting: false })
    expect(from.mock.results[1].value.update).toHaveBeenCalledWith({
      status: 'processing',
      error_message: null,
    })
    expect(rpc).toHaveBeenCalledWith('replace_meeting_summary', expect.objectContaining({
      new_source_content_hash: 'a'.repeat(64),
      new_schema_version: SUMMARY_SCHEMA_VERSION,
      expected_refresh_token: null,
      expected_boarddocs_content_hash: null,
    }))
  })

  it('fences refresh summary writes with the active lease token', async () => {
    const from = vi.fn().mockReturnValueOnce(makeChain({
      data: { id: 'summary-1', revision: 4 },
      error: null,
    }))
    const rpc = vi.fn().mockResolvedValue({ data: 5, error: null })

    await runSummarize('meeting-1', 'Transcript', 'Meeting', adminClient(from, rpc), {
      refreshToken: 'refresh-token',
    })

    expect(rpc).toHaveBeenCalledWith('replace_meeting_summary', expect.objectContaining({
      expected_refresh_token: 'refresh-token',
    }))
  })

  it('does not call AI when a first-summary BoardDocs fence no longer matches', async () => {
    const from = vi.fn()
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
    const rpc = vi.fn()

    await expect(runSummarize(
      'meeting-1',
      'Transcript',
      'Meeting',
      adminClient(from, rpc),
      {
        refreshToken: 'expired-token',
        expectedBoardDocsContentHash: 'a'.repeat(64),
      }
    )).rejects.toThrow('BoardDocs source changed or refresh lease was lost')

    expect(mockSummarizeMeeting).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
  })

  it('fences manual BoardDocs summary writes with the source hash it read', async () => {
    const from = vi.fn().mockReturnValueOnce(makeChain({
      data: { id: 'summary-1', revision: 4 },
      error: null,
    }))
    const rpc = vi.fn().mockResolvedValue({ data: 5, error: null })

    await runSummarize('meeting-1', 'Transcript', 'Meeting', adminClient(from, rpc), {
      expectedBoardDocsContentHash: 'a'.repeat(64),
    })

    expect(rpc).toHaveBeenCalledWith('replace_meeting_summary', expect.objectContaining({
      expected_boarddocs_content_hash: 'a'.repeat(64),
    }))
  })

  it('keeps old summary visible while generating replacement', async () => {
    const from = vi.fn().mockReturnValueOnce(makeChain({
      data: { id: 'summary-1', revision: 4 },
      error: null,
    }))
    const rpc = vi.fn().mockResolvedValue({ data: 5, error: null })

    const result = await runSummarize('meeting-1', 'Transcript', 'Meeting', adminClient(from, rpc))

    expect(result).toEqual({ revision: 5, replacedExisting: true })
    expect(from).toHaveBeenCalledTimes(1)
  })

  it('preserves old summary and valid meeting status after replacement failure', async () => {
    const existing = makeChain({ data: { id: 'summary-1', revision: 4 }, error: null })
    const from = vi.fn().mockReturnValueOnce(existing)
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null })
    mockSummarizeMeeting.mockRejectedValue(new Error('Claude unavailable'))

    await expect(
      runSummarize('meeting-1', 'Transcript', 'Meeting', adminClient(from, rpc))
    ).rejects.toThrow('Claude unavailable')

    expect(rpc).toHaveBeenCalledWith('mark_meeting_summary_failure', expect.objectContaining({
      failure_message: 'Claude unavailable',
    }))
  })

  it('marks only a meeting without a valid summary failed', async () => {
    const from = vi.fn()
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
      .mockReturnValueOnce(makeChain({ data: null, error: null }))
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    mockSummarizeMeeting.mockRejectedValue(new Error('Claude unavailable'))

    await expect(
      runSummarize('meeting-1', 'Transcript', 'Meeting', adminClient(from, rpc))
    ).rejects.toThrow('Claude unavailable')

    expect(rpc).toHaveBeenCalledWith('mark_meeting_summary_failure', expect.objectContaining({
      failure_message: 'Claude unavailable',
    }))
  })
})
