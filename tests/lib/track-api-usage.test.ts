import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test'

const mockInsert = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: vi.fn(() => ({
      insert: mockInsert,
    })),
  }),
}))

import { trackApiUsage } from '@/lib/track-api-usage'
import { calculateAnthropicCostCents } from '@/lib/anthropic-models'

describe('calculateAnthropicCostCents', () => {
  it('calculates Haiku 4.5 pricing', () => {
    expect(calculateAnthropicCostCents({
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })).toBe(600)
  })

  it('calculates Sonnet 4.6 pricing', () => {
    expect(calculateAnthropicCostCents({
      model: 'claude-sonnet-4-6',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })).toBe(1800)
  })

  it('returns zero cost for unknown models', () => {
    expect(calculateAnthropicCostCents({
      model: 'unknown-model',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })).toBe(0)
  })
})

describe('trackApiUsage', () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

  beforeEach(() => {
    mockInsert.mockReset()
    mockInsert.mockResolvedValue({ data: null, error: null })
    warnSpy.mockClear()
  })

  afterEach(() => {
    warnSpy.mockClear()
  })

  it('stores Haiku pricing in cents', async () => {
    await trackApiUsage({
      meetingId: 'meeting-1',
      model: 'claude-haiku-4-5-20251001',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      success: true,
    })

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-haiku-4-5-20251001',
      cost_cents: 600,
    }))
  })

  it('stores zero cents and logs for unknown pricing', async () => {
    await trackApiUsage({
      meetingId: 'meeting-1',
      model: 'unknown-model',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      success: false,
      errorMessage: 'bad model',
    })

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      model: 'unknown-model',
      cost_cents: 0,
      success: false,
      error_message: 'bad model',
    }))
    expect(warnSpy).toHaveBeenCalledWith('Unknown pricing for model unknown-model')
  })
})
