import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendAlertEmail } from '@/lib/resend'
import { formatDate, truncate } from '@/lib/utils'

interface Meeting {
  id: string
  title: string
  body: string
  meeting_date: string
}

interface Summary {
  meeting_id: string
  summary_text: string | null
  topics: string[] | null
  key_decisions: { decision: string }[] | null
  action_items: { item: string }[] | null
}

interface Alert {
  id: string
  user_id: string
  keyword: string
  bodies: string[] | null
  unsubscribe_token: string
}

interface UserProfile {
  id: string
  email: string
}

// This endpoint is called by a cron scheduler to send alert emails.
// CRON_SECRET must be set in production — requests without the correct
// Bearer token are rejected unconditionally.
export async function POST(request: NextRequest) {
  try {
    // Require CRON_SECRET — if the env var is absent the route is locked down.
    // Previously this was conditional (`if (cronSecret && ...)`), meaning an
    // unset CRON_SECRET left the endpoint completely open to anyone.
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get('authorization')

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = createAdminClient()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Get summaries created in the last 24 hours
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const recentMeetingsResult = await supabase
      .from('meetings')
      .select(`
        id,
        title,
        body,
        meeting_date
      `)
      .eq('status', 'summarized')
      .gte('updated_at', yesterday.toISOString())
    const {
      data: recentMeetings,
      error: meetingsError,
    } = recentMeetingsResult as unknown as { data: Meeting[] | null; error: Error | null }

    if (meetingsError) {
      console.error('Error fetching recent meetings:', meetingsError)
      return NextResponse.json(
        { error: 'Failed to fetch meetings' },
        { status: 500 }
      )
    }

    if (!recentMeetings || recentMeetings.length === 0) {
      return NextResponse.json({ message: 'No recent meetings to process', sent: 0 })
    }

    // Get summaries for these meetings
    const meetingIds = recentMeetings.map(m => m.id)
    const summariesResult = await supabase
      .from('summaries')
      .select('*')
      .in('meeting_id', meetingIds)
    const {
      data: summaries,
      error: summariesError,
    } = summariesResult as unknown as { data: Summary[] | null; error: Error | null }

    if (summariesError) {
      console.error('Error fetching summaries:', summariesError)
      return NextResponse.json(
        { error: 'Failed to fetch summaries' },
        { status: 500 }
      )
    }

    // Create a map of meeting_id to summary
    const summaryMap = new Map(summaries?.map(s => [s.meeting_id, s]) || [])

    // Get all active alerts
    const alertsResult = await supabase
      .from('alert_preferences')
      .select(`
        id,
        user_id,
        keyword,
        bodies,
        unsubscribe_token
      `)
      .eq('is_active', true)
    const {
      data: alerts,
      error: alertsError,
    } = alertsResult as unknown as { data: Alert[] | null; error: Error | null }

    if (alertsError) {
      console.error('Error fetching alerts:', alertsError)
      return NextResponse.json(
        { error: 'Failed to fetch alerts' },
        { status: 500 }
      )
    }

    if (!alerts || alerts.length === 0) {
      return NextResponse.json({ message: 'No active alerts', sent: 0 })
    }

    // Get user emails
    const userIds = [...new Set(alerts.map(a => a.user_id))]
    const userProfilesResult = await supabase
      .from('user_profiles')
      .select('id, email')
      .in('id', userIds)
    const {
      data: userProfiles,
      error: usersError,
    } = userProfilesResult as unknown as { data: UserProfile[] | null; error: Error | null }

    if (usersError) {
      console.error('Error fetching user profiles:', usersError)
      return NextResponse.json(
        { error: 'Failed to fetch user profiles' },
        { status: 500 }
      )
    }

    const userEmailMap = new Map(userProfiles?.map(u => [u.id, u.email]) || [])

    // Track sent emails to avoid duplicates
    const sentEmails: { userId: string; meetingId: string; alertId: string }[] = []
    let emailsSent = 0

    // For each meeting, check each alert
    for (const meeting of recentMeetings) {
      const summary = summaryMap.get(meeting.id)
      if (!summary) continue

      // Create searchable text from summary
      const searchableText = [
        summary.summary_text || '',
        ...(summary.topics || []),
        ...(summary.key_decisions || []).map((d) => d.decision),
        ...(summary.action_items || []).map((a) => a.item),
      ].join(' ').toLowerCase()

      for (const alert of alerts) {
        // Check if alert applies to this meeting body
        if (alert.bodies && alert.bodies.length > 0 && !alert.bodies.includes(meeting.body)) {
          continue
        }

        // Check if keyword matches
        const keyword = alert.keyword.toLowerCase()
        if (!searchableText.includes(keyword)) {
          continue
        }

        // Check if we already sent this user an alert for this meeting
        const alreadySent = sentEmails.some(
          e => e.userId === alert.user_id && e.meetingId === meeting.id
        )
        if (alreadySent) continue

        // Get user email
        const userEmail = userEmailMap.get(alert.user_id)
        if (!userEmail) continue

        // Find excerpt containing the keyword
        const excerptText = summary.summary_text || ''
        let excerpt = truncate(excerptText, 300)

        // Try to find a better excerpt around the keyword
        const keywordIndex = excerptText.toLowerCase().indexOf(keyword)
        if (keywordIndex !== -1) {
          const start = Math.max(0, keywordIndex - 100)
          const end = Math.min(excerptText.length, keywordIndex + keyword.length + 200)
          excerpt = (start > 0 ? '...' : '') + excerptText.slice(start, end) + (end < excerptText.length ? '...' : '')
        }

        // Send email
        try {
          await sendAlertEmail({
            to: userEmail,
            keyword: alert.keyword,
            meetingTitle: meeting.title,
            meetingDate: formatDate(meeting.meeting_date),
            meetingBody: meeting.body,
            summaryExcerpt: excerpt,
            meetingUrl: `${appUrl}/meetings/${meeting.id}`,
            unsubscribeUrl: `${appUrl}/unsubscribe/${alert.unsubscribe_token}`,
          })

          // Record in alert history
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('alert_history') as any).insert({
            user_id: alert.user_id,
            meeting_id: meeting.id,
            alert_preference_id: alert.id,
            email_status: 'sent',
          })

          sentEmails.push({
            userId: alert.user_id,
            meetingId: meeting.id,
            alertId: alert.id,
          })
          emailsSent++
        } catch (emailError) {
          console.error('Error sending alert email:', emailError)

          // Record failed email
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('alert_history') as any).insert({
            user_id: alert.user_id,
            meeting_id: meeting.id,
            alert_preference_id: alert.id,
            email_status: 'failed',
          })
        }
      }
    }

    return NextResponse.json({
      message: 'Alert processing complete',
      sent: emailsSent,
      processed: recentMeetings.length,
    })
  } catch (error) {
    console.error('Unexpected error in send-alerts:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
