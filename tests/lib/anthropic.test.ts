import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.hoisted runs before imports, so mockCreate is available inside vi.mock's factory
const mockCreate = vi.hoisted(() => vi.fn())

vi.mock('@anthropic-ai/sdk', () => ({
  // Must be a class so `new Anthropic({...})` works in lib/anthropic.ts
  default: class {
    messages = { create: mockCreate }
  },
}))

import { summarizeMeeting, estimateTokens, chunkTranscript } from '@/lib/anthropic'

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

describe('summarizeMeeting', () => {
  const validSummaryJson = JSON.stringify({
    summary_text: 'The board approved the FY2026 budget with amendments.',
    topics: ['Budget', 'Staffing'],
    key_decisions: [{ decision: 'Budget approved', context: 'After review' }],
    action_items: [{ item: 'Publish final budget', responsible_party: 'CFO', deadline: '2026-04-01' }],
    sentiment: 'neutral',
  })

  beforeEach(() => {
    mockCreate.mockReset()
  })

  it('calls the Anthropic API with model claude-sonnet-4-6', async () => {
    mockCreate.mockResolvedValueOnce(mockResponse(validSummaryJson))

    await summarizeMeeting('Test transcript')

    expect(mockCreate).toHaveBeenCalledOnce()
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

    expect(summary.summary_text).toBe('The board approved the FY2026 budget with amendments.')
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

  it('strips ```json markdown fences from the response', async () => {
    const wrapped = '```json\n' + validSummaryJson + '\n```'
    mockCreate.mockResolvedValueOnce(mockResponse(wrapped))

    const { summary } = await summarizeMeeting('Test transcript')
    expect(summary.summary_text).toBe('The board approved the FY2026 budget with amendments.')
  })

  it('strips plain ``` fences (no language tag)', async () => {
    const wrapped = '```\n' + validSummaryJson + '\n```'
    mockCreate.mockResolvedValueOnce(mockResponse(wrapped))

    const { summary } = await summarizeMeeting('Test transcript')
    expect(summary.summary_text).toBeTruthy()
  })

  it('throws when the response contains invalid JSON', async () => {
    mockCreate.mockResolvedValueOnce(mockResponse('not valid json at all'))

    await expect(summarizeMeeting('Test transcript')).rejects.toThrow(
      'Failed to parse summary response as JSON'
    )
  })

  it('throws when summary_text is missing from response', async () => {
    const invalid = JSON.stringify({ topics: ['Budget'] })
    mockCreate.mockResolvedValueOnce(mockResponse(invalid))

    await expect(summarizeMeeting('Test transcript')).rejects.toThrow(
      'Invalid summary structure'
    )
  })

  it('throws when the API returns no text content block', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'tool_use', id: 'x', name: 'y', input: {} }],
      usage: { input_tokens: 0, output_tokens: 0 },
    })

    await expect(summarizeMeeting('Test transcript')).rejects.toThrow(
      'No text response from Claude'
    )
  })

  it('defaults missing key_decisions and action_items to empty arrays', async () => {
    const minimal = JSON.stringify({ summary_text: 'Brief summary', topics: ['X'] })
    mockCreate.mockResolvedValueOnce(mockResponse(minimal))

    const { summary } = await summarizeMeeting('Test transcript')
    expect(summary.key_decisions).toEqual([])
    expect(summary.action_items).toEqual([])
  })
})
