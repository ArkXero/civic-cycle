import { createAdminClient } from '@/lib/supabase/server'
import { getMotionDigestsByMeetingIds, type MeetingMotionDigest } from '@/lib/data/motions'

/**
 * Motion digests for list views, keyed by meeting id. Uses the admin client like the
 * meeting detail page does for motions; failures degrade to rows without vote data.
 */
export async function loadMotionDigests(meetingIds: string[]): Promise<Record<string, MeetingMotionDigest>> {
  try {
    const digests = await getMotionDigestsByMeetingIds(createAdminClient(), meetingIds)
    return Object.fromEntries(digests)
  } catch {
    return {}
  }
}
