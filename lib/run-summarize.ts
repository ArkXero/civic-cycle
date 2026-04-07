import { summarizeMeeting, chunkTranscript } from '@/lib/anthropic'
import { createAdminClient } from '@/lib/supabase/server'
import { logActivity, ActivityTypes } from '@/lib/activity'
import { trackApiUsage } from '@/lib/track-api-usage'

type AdminClient = ReturnType<typeof createAdminClient>

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
    .update({ status: 'processing' })
    .eq('id', meetingId)

  try {
    const chunks = chunkTranscript(transcript)
    let result

    if (chunks.length === 1) {
      result = await summarizeMeeting(transcript, title)
    } else {
      console.log(`Transcript split into ${chunks.length} chunks, using first chunk`)
      result = await summarizeMeeting(
        chunks[0] + '\n\n[Note: This is a partial transcript due to length]',
        title
      )
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
    await Promise.all([
      trackApiUsage({
        meetingId,
        model: 'claude-sonnet-4-6',
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        success: true,
      }),
      logActivity(
        ActivityTypes.SUMMARY_GENERATED,
        `Generated summary for "${title}" (${totalTokens} tokens)`,
        { meetingId, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens }
      ),
    ])
  } catch (error) {
    console.error('Summarization failed for meeting', meetingId, error)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient.from('meetings') as any)
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', meetingId)

    // Log the failure (fire-and-forget)
    await Promise.all([
      trackApiUsage({
        meetingId,
        model: 'claude-sonnet-4-6',
        inputTokens: 0,
        outputTokens: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }),
      logActivity(
        ActivityTypes.SUMMARY_FAILED,
        `Summary failed for "${title}": ${error instanceof Error ? error.message : 'Unknown error'}`,
        { meetingId }
      ),
    ])

    throw error
  }
}
