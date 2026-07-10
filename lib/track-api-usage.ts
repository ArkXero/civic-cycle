import { createAdminClient } from '@/lib/supabase/server'
import {
  calculateAnthropicCostCents,
  getAnthropicModelPricing,
} from '@/lib/anthropic-models'

// Server-side only — never import this from a client component.
// Costs are stored in cents (integer) to avoid floating-point rounding.

export async function trackApiUsage({
  meetingId,
  model,
  inputTokens,
  outputTokens,
  success,
  errorMessage,
}: {
  meetingId: string
  model: string
  inputTokens: number
  outputTokens: number
  success: boolean
  errorMessage?: string
}): Promise<void> {
  if (!getAnthropicModelPricing(model)) {
    console.warn(`Unknown pricing for model ${model}`)
  }

  const costCents = calculateAnthropicCostCents({ model, inputTokens, outputTokens })

  try {
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient.from('api_usage') as any).insert({
      meeting_id: meetingId,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_cents: costCents,
      success,
      error_message: errorMessage ?? null,
    })
  } catch (error) {
    // Never throw — tracking must not break the caller
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Failed to track API usage:', message)
  }
}
