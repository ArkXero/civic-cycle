import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { generateDigestContent, DigestMeeting } from '@/lib/digest'
import { sendDigestEmail } from '@/lib/resend'
import { formatDate } from '@/lib/utils'

interface MeetingRow {
  id: string
  title: string
  body: string
  meeting_date: string
}

interface SummaryRow {
  meeting_id: string
  summary_text: string
}

interface SubscriberRow {
  id: string
  email: string
  unsubscribe_token: string
}

type QueryResult<T> = { data: T | null; error: Error | null }

function errorResponse(error: string, code: string, status = 500) {
  return NextResponse.json({ error, code }, { status })
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return errorResponse('Unauthorized', 'UNAUTHORIZED', 401)
  }

  // 7-day window — meeting_date is date-only (YYYY-MM-DD)
  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - 7)
  const windowStartDate = windowStart.toISOString().slice(0, 10)

  console.log('digest: route start', {
    route: '/api/digest/send',
    windowStartDate,
    hasCronSecret: Boolean(process.env.CRON_SECRET),
    hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasResendApiKey: Boolean(process.env.RESEND_API_KEY),
    hasAppUrl: Boolean(process.env.NEXT_PUBLIC_APP_URL),
  })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('digest: missing required environment configuration', {
      code: 'CONFIG_ERROR',
      hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    })
    return errorResponse('Digest misconfigured', 'CONFIG_ERROR')
  }

  try {
    const supabase = createAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const { data: meetings, error: meetingsError } = (await supabase
      .from('meetings')
      .select('id, title, body, meeting_date')
      .eq('status', 'summarized')
      .eq('body', 'FCPS School Board')
      .eq('digest_sent', false)
      .gte('meeting_date', windowStartDate)) as unknown as QueryResult<MeetingRow[]>

    if (meetingsError) {
      console.error('digest: error fetching meetings', {
        code: 'MEETINGS_QUERY_FAILED',
        message: meetingsError.message,
      })
      return errorResponse('Failed to fetch meetings', 'MEETINGS_QUERY_FAILED')
    }

    if (!meetings || meetings.length === 0) {
      return NextResponse.json({ message: 'No meetings to digest', sent: 0 })
    }

    const meetingIds = meetings.map((m) => m.id)

    const { data: summaries, error: summariesError } = (await supabase
      .from('summaries')
      .select('meeting_id, summary_text')
      .in('meeting_id', meetingIds)) as unknown as QueryResult<SummaryRow[]>

    if (summariesError) {
      console.error('digest: error fetching summaries', {
        code: 'SUMMARIES_QUERY_FAILED',
        message: summariesError.message,
      })
      return errorResponse('Failed to fetch summaries', 'SUMMARIES_QUERY_FAILED')
    }

    const summaryMap = new Map((summaries ?? []).map((s) => [s.meeting_id, s.summary_text]))

    const digestMeetings: DigestMeeting[] = meetings
      .filter((m) => summaryMap.has(m.id))
      .map((m) => ({
        id: m.id,
        title: m.title,
        meeting_date: m.meeting_date,
        summary_text: summaryMap.get(m.id)!,
      }))

    const content = generateDigestContent(digestMeetings, appUrl)
    if (!content) {
      return NextResponse.json({ message: 'No meetings to digest', sent: 0 })
    }

    // Build week range string from oldest → newest meeting date
    const sortedDates = digestMeetings.map((m) => m.meeting_date).sort()
    const weekRange =
      sortedDates.length === 1
        ? formatDate(sortedDates[0])
        : `${formatDate(sortedDates[0])} – ${formatDate(sortedDates[sortedDates.length - 1])}`

    const { data: subscribers, error: subscribersError } = (await supabase
      .from('digest_subscribers')
      .select('id, email, unsubscribe_token')
      .eq('active', true)) as unknown as QueryResult<SubscriberRow[]>

    if (subscribersError) {
      console.error('digest: error fetching subscribers', {
        code: 'SUBSCRIBERS_QUERY_FAILED',
        message: subscribersError.message,
      })
      return errorResponse('Failed to fetch subscribers', 'SUBSCRIBERS_QUERY_FAILED')
    }

    if (!subscribers || subscribers.length === 0) {
      return NextResponse.json({ message: 'No active subscribers', sent: 0 })
    }

    let emailsSent = 0

    for (const subscriber of subscribers) {
      try {
        const { error: sendError } = await sendDigestEmail({
          to: subscriber.email,
          unsubscribeUrl: `${appUrl}/unsubscribe/digest/${subscriber.unsubscribe_token}`,
          digestHtml: content.html,
          digestText: content.text,
          weekRange,
        })
        if (sendError) {
          console.error(`digest: resend error for ${subscriber.email}:`, sendError)
        } else {
          emailsSent++
        }
      } catch (err) {
        console.error(`digest: failed to send to ${subscriber.email}:`, err)
      }
    }

    // Mark all meetings as sent in a single update
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('meetings')
      .update({ digest_sent: true, digest_sent_at: new Date().toISOString() })
      .in('id', meetingIds)

    if (updateError) {
      console.error('digest: error marking meetings sent', {
        code: 'MEETINGS_UPDATE_FAILED',
        message: updateError.message,
      })
    }

    return NextResponse.json({
      message: 'Digest sent',
      sent: emailsSent,
      meetings: meetingIds.length,
    })
  } catch (error) {
    console.error('digest: unexpected route error', {
      code: 'UNEXPECTED_ERROR',
      error: error instanceof Error ? error.message : String(error),
    })
    return errorResponse('Digest misconfigured', 'CONFIG_ERROR')
  }
}
