import {
  summarizeMeeting,
  synthesizeChunkSummaries,
  chunkTranscript,
  SummaryGenerationError,
  type MeetingSummary,
  type SummarizeResult,
} from '@/lib/anthropic'
import { createAdminClient } from '@/lib/supabase/server'
import { logActivity, ActivityTypes } from '@/lib/activity'
import { trackApiUsage } from '@/lib/track-api-usage'
import { getSummaryFallbackModel, getSummaryModel } from '@/lib/anthropic-models'

type AdminClient = ReturnType<typeof createAdminClient>

const CLAUDE_TIMEOUT_MS = 120_000

interface SummaryAttemptRecord {
  model: string
  inputTokens: number
  outputTokens: number
  success: boolean
  errorMessage?: string
}

interface SummarizeWithFallbackResult {
  result: SummarizeResult
  attempts: SummaryAttemptRecord[]
}

type SummarizeWithFallbackParams =
  | {
      transcript: string
      title: string
      mode: 'summary'
    }
  | {
      chunkSummaries: MeetingSummary[]
      title: string
      mode: 'synthesis'
    }

class SummarizeWithFallbackError extends Error {
  constructor(
    message: string,
    public readonly attempts: SummaryAttemptRecord[]
  ) {
    super(message)
    this.name = 'SummarizeWithFallbackError'
  }
}

function attemptFromError(error: unknown): SummaryAttemptRecord | null {
  if (!(error instanceof SummaryGenerationError) || !error.usage) {
    return null
  }

  return {
    model: error.model,
    inputTokens: error.usage.input_tokens,
    outputTokens: error.usage.output_tokens,
    success: false,
    errorMessage: error.message,
  }
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(CLAUDE_TIMEOUT_MS / 1000)} seconds`))
    }, CLAUDE_TIMEOUT_MS)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

async function summarizeWithFallback(params: SummarizeWithFallbackParams): Promise<SummarizeWithFallbackResult> {
  const attempts: SummaryAttemptRecord[] = []
  const primaryModel = getSummaryModel()
  const fallbackModel = getSummaryFallbackModel()
  const runAttempt = (model: string) => params.mode === 'summary'
    ? summarizeMeeting(params.transcript, params.title, { model })
    : synthesizeChunkSummaries(params.chunkSummaries, params.title, { model })

  try {
    const result = await runAttempt(primaryModel)
    attempts.push({
      model: result.model,
      inputTokens: result.usage.input_tokens,
      outputTokens: result.usage.output_tokens,
      success: true,
    })
    return { result, attempts }
  } catch (error) {
    const primaryAttempt = attemptFromError(error)
    if (primaryAttempt) {
      attempts.push({
        ...primaryAttempt,
        errorMessage: `fallback:${primaryAttempt.errorMessage}`,
      })
    }

    if (!(error instanceof SummaryGenerationError) || !error.fallbackEligible) {
      throw new SummarizeWithFallbackError(
        error instanceof Error ? error.message : 'Unknown summary error',
        attempts
      )
    }

    if (fallbackModel === primaryModel) {
      throw new SummarizeWithFallbackError(
        `Fallback model matches primary model after failure: ${primaryModel}`,
        attempts
      )
    }

    try {
      const result = await runAttempt(fallbackModel)
      attempts.push({
        model: result.model,
        inputTokens: result.usage.input_tokens,
        outputTokens: result.usage.output_tokens,
        success: true,
      })
      return { result, attempts }
    } catch (fallbackError) {
      const fallbackAttempt = attemptFromError(fallbackError)
      if (fallbackAttempt) {
        attempts.push(fallbackAttempt)
      }

      const message = fallbackError instanceof Error ? fallbackError.message : 'Unknown fallback summary error'
      throw new SummarizeWithFallbackError(
        `Fallback summary failed after primary ${primaryModel} failed: ${message}`,
        attempts
      )
    }
  }
}

/**
 * Runs the full summarization flow for a meeting:
 * sets status → processing, calls Claude, saves summary, sets status → summarized.
 *
 * On failure: sets status → failed and re-throws so callers can handle it.
 * For fire-and-forget usage, call with .catch() to swallow the throw.
 */
export async function runSummarize(
  meetingId: string,
  transcript: string,
  title: string,
  adminClient: AdminClient
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminClient.from('meetings') as any)
    .update({ status: 'processing', error_message: null })
    .eq('id', meetingId)

  let capturedAttempts: SummaryAttemptRecord[] = []

  try {
    const chunks = chunkTranscript(transcript)
    let result: SummarizeResult

    if (chunks.length === 1) {
      const summaryRun = await withTimeout(
        summarizeWithFallback({ transcript, title, mode: 'summary' }),
        'Claude summary request'
      )
      result = summaryRun.result
      capturedAttempts = summaryRun.attempts
    } else {
      console.log(`Transcript split into ${chunks.length} chunks, summarizing each then synthesizing`)
      const chunkResults = await Promise.all(
        chunks.map((chunk, i) =>
          withTimeout(
            summarizeWithFallback({
              transcript: chunk,
              title: `${title} (Part ${i + 1} of ${chunks.length})`,
              mode: 'summary',
            }),
            `Claude summary request for chunk ${i + 1}`
          )
        )
      )
      const chunkUsage = chunkResults.reduce(
        (acc, r) => ({
          input_tokens: acc.input_tokens + r.result.usage.input_tokens,
          output_tokens: acc.output_tokens + r.result.usage.output_tokens,
        }),
        { input_tokens: 0, output_tokens: 0 }
      )
      capturedAttempts = chunkResults.flatMap((r) => r.attempts)
      const synthesisRun = await withTimeout(
        summarizeWithFallback({
          chunkSummaries: chunkResults.map((r) => r.result.summary),
          title,
          mode: 'synthesis',
        }),
        'Claude synthesis request'
      )
      capturedAttempts = [...capturedAttempts, ...synthesisRun.attempts]
      const synthesis = synthesisRun.result
      result = {
        summary: synthesis.summary,
        usage: {
          input_tokens: chunkUsage.input_tokens + synthesis.usage.input_tokens,
          output_tokens: chunkUsage.output_tokens + synthesis.usage.output_tokens,
        },
        model: synthesis.model,
      }
    }

    const { summary, usage } = result

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: saveError } = await (adminClient.from('summaries') as any)
      .insert({
        meeting_id: meetingId,
        summary_text: summary.summary_text,
        topics: summary.topics,
        key_decisions: summary.key_decisions,
        action_items: summary.action_items,
      })

    if (saveError) {
      throw new Error(`Failed to save summary: ${saveError.message}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient.from('meetings') as any)
      .update({ status: 'summarized' })
      .eq('id', meetingId)

    // Track API usage and log the activity (fire-and-forget, never throws)
    const totalTokens = usage.input_tokens + usage.output_tokens
    const fallbackUsed = capturedAttempts.some((attempt) => attempt.model !== getSummaryModel())
    await Promise.all([
      ...capturedAttempts.map((attempt) =>
        trackApiUsage({
          meetingId,
          model: attempt.model,
          inputTokens: attempt.inputTokens,
          outputTokens: attempt.outputTokens,
          success: attempt.success,
          errorMessage: attempt.errorMessage,
        })
      ),
      logActivity(
        ActivityTypes.SUMMARY_GENERATED,
        `Generated summary for "${title}" with ${result.model} (${totalTokens} tokens)`,
        {
          meetingId,
          model: result.model,
          fallbackUsed,
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
        }
      ),
    ])
  } catch (error) {
    console.error('Summarization failed for meeting', meetingId, error)
    if (error instanceof SummarizeWithFallbackError) {
      capturedAttempts = error.attempts
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient.from('meetings') as any)
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', meetingId)

    // Log the failure (fire-and-forget)
    await Promise.all([
      ...capturedAttempts.map((attempt) =>
        trackApiUsage({
          meetingId,
          model: attempt.model,
          inputTokens: attempt.inputTokens,
          outputTokens: attempt.outputTokens,
          success: attempt.success,
          errorMessage: attempt.errorMessage ?? (error instanceof Error ? error.message : 'Unknown error'),
        })
      ),
      logActivity(
        ActivityTypes.SUMMARY_FAILED,
        `Summary failed for "${title}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        { meetingId }
      ),
    ])

    throw error
  }
}
