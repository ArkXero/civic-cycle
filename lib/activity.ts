import { createAdminClient } from '@/lib/supabase/server'

// Server-side only — never import this from a client component.

export const ActivityTypes = {
  MEETING_IMPORTED: 'meeting_imported',
  SUMMARY_GENERATED: 'summary_generated',
  SUMMARY_FAILED: 'summary_failed',
  EMAIL_SENT: 'email_sent',
  API_ERROR: 'api_error',
  USER_PROMOTED: 'user_promoted',
  USER_DEMOTED: 'user_demoted',
} as const

export type ActivityType = (typeof ActivityTypes)[keyof typeof ActivityTypes]

export async function logActivity(
  action: string,
  description: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminClient.from('activity_logs') as any).insert({
      action,
      description,
      metadata: metadata ?? null,
    })
  } catch (error) {
    // Never throw — activity logging must not break the caller
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Failed to log activity:', message)
  }
}
