import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendAlertEmail } from '@/lib/resend'
import { formatDate, truncate } from '@/lib/utils'

// This endpoint is called by Vercel Cron to send alert emails
// It should be protected by a secret in production
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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

    const { data: recentMeetings, error: meetingsError } = await supabase
      .from('meetings')
      .select(`
        id,
        title,
        body,
        meeting_date
      `)
      .eq('status', 'summarized')
      .gte('updated_at', yesterday.toISOString())

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
    const { data: summaries, error: summariesError } = await supabase
      .from('summaries')
      .select('*')
      .in('meeting_id', meetingIds)

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
    const { data: alerts, error: alertsError } = await supabase
      .from('alert_preferences')
      .select(`
        id,
        user_id,
        keyword,
        bodies
      `)
      .eq('is_active', true)

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
    const { data: userProfiles, error: usersError } = await supabase
      .from('user_profiles')
      .select('id, email')
      .in('id', userIds)

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
        ...(summary.key_decisions || []).map((d: { decision: string }) => d.decision),
        ...(summary.action_items || []).map((a: { item: string }) => a.item),
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
        const excerptStart = searchableText.indexOf(keyword)
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
            unsubscribeUrl: `${appUrl}/unsubscribe/${alert.id}`,
          })

          // Record in alert history
          await supabase.from('alert_history').insert({
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
          await supabase.from('alert_history').insert({
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

// Also allow GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request)
}
