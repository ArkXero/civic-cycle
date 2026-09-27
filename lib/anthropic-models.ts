export const DEFAULT_SUMMARY_MODEL = 'claude-haiku-4-5-20251001'
export const DEFAULT_SUMMARY_FALLBACK_MODEL = 'claude-sonnet-4-6'

export interface AnthropicModelPricing {
  inputUsdPerMTok: number
  outputUsdPerMTok: number
}

export const ANTHROPIC_MODEL_PRICING: Record<string, AnthropicModelPricing> = {
  'claude-haiku-4-5-20251001': {
    inputUsdPerMTok: 1,
    outputUsdPerMTok: 5,
  },
  'claude-haiku-4-5': {
    inputUsdPerMTok: 1,
    outputUsdPerMTok: 5,
  },
  'claude-sonnet-4-6': {
    inputUsdPerMTok: 3,
    outputUsdPerMTok: 15,
  },
}

export function getSummaryModel() {
  return process.env.ANTHROPIC_SUMMARY_MODEL || DEFAULT_SUMMARY_MODEL
}

export function getSummaryFallbackModel() {
  return process.env.ANTHROPIC_SUMMARY_FALLBACK_MODEL || DEFAULT_SUMMARY_FALLBACK_MODEL
}

export function getAnthropicModelPricing(model: string) {
  return ANTHROPIC_MODEL_PRICING[model] ?? null
}

export function calculateAnthropicCostCents({
  model,
  inputTokens,
  outputTokens,
}: {
  model: string
  inputTokens: number
  outputTokens: number
}) {
  const pricing = getAnthropicModelPricing(model)
  if (!pricing) return 0

  return Math.round(
    ((inputTokens / 1_000_000) * pricing.inputUsdPerMTok +
      (outputTokens / 1_000_000) * pricing.outputUsdPerMTok) *
      100
  )
}
