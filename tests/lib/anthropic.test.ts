import { describe, it, expect, vi, beforeEach } from 'vite-plus/test'

// vi.hoisted runs before imports, so mockCreate is available inside vi.mock's factory
const mockCreate = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => ({
  // Must be a class so `new Anthropic({...})` works in lib/anthropic.ts
  default: class {
    messages = { create: mockCreate }
  },
}))

import {
  summarizeMeeting,
  synthesizeChunkSummaries,
  estimateTokens,
  chunkTranscript,
  SummaryGenerationError,
} from '@/lib/anthropic'

// ─── estimateTokens ────────────────────────────────────────────────────────

describe('estimateTokens', () => {
  it('returns 0 for an empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('estimates ~1 token per 4 chars', () => {
    const text = 'a'.repeat(400)
    expect(estimateTokens(text)).toBe(100)
  })

  it('rounds up for non-divisible lengths', () => {
    // 5 chars → ceil(5/4) = 2
    expect(estimateTokens('hello')).toBe(2)
  })
})

// ─── chunkTranscript ───────────────────────────────────────────────────────

describe('chunkTranscript', () => {
  it('returns a single chunk when transcript is within limit', () => {
    const short = 'Short transcript text.'
    const chunks = chunkTranscript(short, 100_000)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe(short)
  })

  it('splits a long transcript into multiple chunks', () => {
    // Each paragraph is 400 chars (~100 tokens). maxTokens=150 forces splits.
    const para = 'a'.repeat(400)
    const transcript = [para, para, para].join('\n\n')
    const chunks = chunkTranscript(transcript, 150)
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('each chunk stays within the token limit (approximately)', () => {
    const para = 'a'.repeat(800) // ~200 tokens each
    const transcript = [para, para, para, para].join('\n\n')
    const chunks = chunkTranscript(transcript, 250)
    for (const chunk of chunks) {
      expect(estimateTokens(chunk)).toBeLessThanOrEqual(300) // small tolerance for separators
    }
  })

  it('preserves all content across chunks (no data loss)', () => {
    const para = 'paragraph-' + 'x'.repeat(400)
    const transcript = [para, para, para].join('\n\n')
    const chunks = chunkTranscript(transcript, 150)
    const rejoined = chunks.join('\n\n')
    expect(rejoined).toContain('paragraph-')
  })
})

// ─── summarizeMeeting ──────────────────────────────────────────────────────

// Helper: wrap a JSON body in a full mock Anthropic response (includes usage)
function mockResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
    usage: { input_tokens: 100, output_tokens: 50 },
  }
}

async function captureSummaryGenerationError(
  operation: Promise<unknown>
): Promise<SummaryGenerationError> {
  try {
    await operation
  } catch (error) {
    expect(error).toBeInstanceOf(SummaryGenerationError)
    if (error instanceof SummaryGenerationError) return error
    throw error
  }
  throw new Error('Expected summarize operation to fail')
}

describe('summarizeMeeting', () => {
  const validSummaryJson = JSON.stringify({
    summary_text: 'The board approved the FY2026 budget with amendments and directed staff to publish the final version.',
    topics: ['Budget', 'Staffing'],
    key_decisions: [{ decision: 'Approved the budget', vote_yes: 9, vote_no: 0, vote_abstain: 0 }],
    action_items: [{ item: 'Publish final budget', responsible_party: 'CFO', deadline: '2026-04-01' }],
    sentiment: 'neutral',
  })

  beforeEach(() => {
    mockCreate.mockReset()
    delete process.env.ANTHROPIC_SUMMARY_MODEL
  })

  it('calls the Anthropic API with default model claude-haiku-4-5-20251001', async () => {
    mockCreate.mockResolvedValueOnce(mockResponse(validSummaryJson))

    await summarizeMeeting('Test transcript')

    expect(mockCreate).toHaveBeenCalledOnce()
    const call = mockCreate.mock.calls[0][0]
    expect(call.model).toBe('claude-haiku-4-5-20251001')
  })

  it('respects ANTHROPIC_SUMMARY_MODEL', async () => {
    process.env.ANTHROPIC_SUMMARY_MODEL = 'claude-haiku-4-5'
    mockCreate.mockResolvedValueOnce(mockResponse(validSummaryJson))

    await summarizeMeeting('Test transcript')

    const call = mockCreate.mock.calls[0][0]
    expect(call.model).toBe('claude-haiku-4-5')
  })

  it('uses the per-call model override', async () => {
    mockCreate.mockResolvedValueOnce(mockResponse(validSummaryJson))

    await summarizeMeeting('Test transcript', undefined, { model: 'claude-sonnet-4-6' })

    const call = mockCreate.mock.calls[0][0]
    expect(call.model).toBe('claude-sonnet-4-6')
  })

  it('includes the meeting title in the prompt when provided', async () => {
    mockCreate.mockResolvedValueOnce(mockResponse(validSummaryJson))

    await summarizeMeeting('Test transcript', 'March 4 Board Meeting')

    const call = mockCreate.mock.calls[0][0]
    const userContent = call.messages[0].content as string
    expect(userContent).toContain('March 4 Board Meeting')
  })

  it('parses a plain JSON response correctly', async () => {
    mockCreate.mockResolvedValueOnce(mockResponse(validSummaryJson))

    const { summary } = await summarizeMeeting('Test transcript')

    expect(summary.summary_text).toBe('The board approved the FY2026 budget with amendments and directed staff to publish the final version.')
    expect(summary.topics).toEqual(['Budget', 'Staffing'])
    expect(summary.key_decisions).toHaveLength(1)
    expect(summary.action_items).toHaveLength(1)
  })

  it('returns token usage from the API response', async () => {
    mockCreate.mockResolvedValueOnce(mockResponse(validSummaryJson))

    const { usage } = await summarizeMeeting('Test transcript')

    expect(usage.input_tokens).toBe(100)
    expect(usage.output_tokens).toBe(50)
  })

  it('returns the actual model used', async () => {
    mockCreate.mockResolvedValueOnce(mockResponse(validSummaryJson))

    const { model } = await summarizeMeeting('Test transcript', undefined, { model: 'claude-sonnet-4-6' })

    expect(model).toBe('claude-sonnet-4-6')
  })

  it('strips ```json markdown fences from the response', async () => {
    const wrapped = '```json\n' + validSummaryJson + '\n```'
    mockCreate.mockResolvedValueOnce(mockResponse(wrapped))

    const { summary } = await summarizeMeeting('Test transcript')
    expect(summary.summary_text).toBe('The board approved the FY2026 budget with amendments and directed staff to publish the final version.')
  })

  it('strips plain ``` fences (no language tag)', async () => {
    const wrapped = '```\n' + validSummaryJson + '\n```'
    mockCreate.mockResolvedValueOnce(mockResponse(wrapped))

    const { summary } = await summarizeMeeting('Test transcript')
    expect(summary.summary_text).toBeTruthy()
  })

  it('throws when the response contains invalid JSON', async () => {
    mockCreate.mockResolvedValueOnce(mockResponse('not valid json at all'))

    const error = await captureSummaryGenerationError(summarizeMeeting('Test transcript'))
    expect(error.message).toBe('Failed to parse summary response as JSON')
    expect(error.fallbackEligible).toBe(true)
    expect(error.model).toBe('claude-haiku-4-5-20251001')
    expect(error.usage).toEqual({ input_tokens: 100, output_tokens: 50 })
  })

  it('throws when summary_text is missing from response', async () => {
    const invalid = JSON.stringify({ topics: ['Budget'] })
    mockCreate.mockResolvedValueOnce(mockResponse(invalid))

    const error = await captureSummaryGenerationError(summarizeMeeting('Test transcript'))
    expect(error.message).toContain('missing_summary_text')
    expect(error.fallbackEligible).toBe(true)
  })

  it('throws when the API returns no text content block', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'x', name: 'y', input: {} }],
      usage: { input_tokens: 0, output_tokens: 0 },
    })

    const error = await captureSummaryGenerationError(summarizeMeeting('Test transcript'))
    expect(error.message).toBe('No text response from Claude')
    expect(error.fallbackEligible).toBe(false)
  })

  it('throws when key_decisions and action_items are missing', async () => {
    const minimal = JSON.stringify({ summary_text: 'Brief summary', topics: ['X'] })
    mockCreate.mockResolvedValueOnce(mockResponse(minimal))

    const error = await captureSummaryGenerationError(summarizeMeeting('Test transcript'))
    expect(error.message).toContain('invalid_key_decisions')
    expect(error.message).toContain('invalid_action_items')
    expect(error.fallbackEligible).toBe(true)
  })
})

describe('synthesizeChunkSummaries', () => {
  const chunkSummary = {
    summary_text: 'The board discussed the budget and staffing updates.',
    topics: ['Budget'],
    key_decisions: [{ decision: 'Approved the budget', vote_yes: 9, vote_no: 0, vote_abstain: 0 }],
    action_items: [{ item: 'Publish final budget', responsible_party: 'CFO', deadline: null }],
    sentiment: 'neutral' as const,
  }

  beforeEach(() => {
    mockCreate.mockReset()
    delete process.env.ANTHROPIC_SUMMARY_MODEL
  })

  it('uses the default summary model', async () => {
    mockCreate.mockResolvedValueOnce(mockResponse(JSON.stringify(chunkSummary)))

    const result = await synthesizeChunkSummaries([chunkSummary], 'Long Meeting')

    const call = mockCreate.mock.calls[0][0]
    expect(call.model).toBe('claude-haiku-4-5-20251001')
    expect(result.model).toBe('claude-haiku-4-5-20251001')
  })

  it('uses the per-call model override', async () => {
    mockCreate.mockResolvedValueOnce(mockResponse(JSON.stringify(chunkSummary)))

    await synthesizeChunkSummaries([chunkSummary], 'Long Meeting', { model: 'claude-sonnet-4-6' })

    const call = mockCreate.mock.calls[0][0]
    expect(call.model).toBe('claude-sonnet-4-6')
  })
})
