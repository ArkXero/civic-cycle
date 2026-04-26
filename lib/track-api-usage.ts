import { createAdminClient } from '@/lib/supabase/server'

// Server-side only — never import this from a client component.
// Pricing for claude-sonnet-4-6: $3/M input tokens, $15/M output tokens.
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
  const inputCostCents = (inputTokens / 1_000_000) * 3 * 100
  const outputCostCents = (outputTokens / 1_000_000) * 15 * 100
  const costCents = Math.round(inputCostCents + outputCostCents)

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
