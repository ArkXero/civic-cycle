import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/is-admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const adminClient = createAdminClient()
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
  ).toISOString()

  const [
    meetingsTotal,
    meetingsThisMonth,
    meetingsPending,
    meetingsFailed,
    meetingsSummarized,
    apiUsageRows,
    alertsTotal,
    alertsThisMonth,
    emailsSentThisMonth,
    recentActivity,
  ] = await Promise.all([
    adminClient.from('meetings').select('id', { count: 'exact', head: true }),
    adminClient.from('meetings').select('id', { count: 'exact', head: true }).gte('created_at', startOfMonth),
    adminClient.from('meetings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    adminClient.from('meetings').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
    adminClient.from('meetings').select('id', { count: 'exact', head: true }).eq('status', 'summarized'),
    // Fetch all rows for this month so we can aggregate in JS (Supabase doesn't have SUM in REST)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient.from('api_usage') as any)
      .select('input_tokens, output_tokens, cost_cents')
      .gte('created_at', startOfMonth),
    adminClient
      .from('alert_preferences')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),
    adminClient
      .from('alert_preferences')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', startOfMonth),
    adminClient
      .from('alert_history')
      .select('id', { count: 'exact', head: true })
      .gte('sent_at', startOfMonth),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (adminClient.from('activity_logs') as any)
      .select('id, action, description, created_at, metadata')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiRows: any[] = apiUsageRows.data ?? []
  const apiAgg = apiRows.reduce(
    (acc: { inputTokens: number; outputTokens: number; costCents: number; calls: number }, row: { input_tokens: number; output_tokens: number; cost_cents: number }) => ({
      inputTokens: acc.inputTokens + row.input_tokens,
      outputTokens: acc.outputTokens + row.output_tokens,
      costCents: acc.costCents + row.cost_cents,
      calls: acc.calls + 1,
    }),
    { inputTokens: 0, outputTokens: 0, costCents: 0, calls: 0 }
  )

  return NextResponse.json({
    meetings: {
      total: meetingsTotal.count ?? 0,
      thisMonth: meetingsThisMonth.count ?? 0,
      pending: meetingsPending.count ?? 0,
      failed: meetingsFailed.count ?? 0,
      summarized: meetingsSummarized.count ?? 0,
    },
    alerts: {
      totalActive: alertsTotal.count ?? 0,
      newThisMonth: alertsThisMonth.count ?? 0,
      emailsSentThisMonth: emailsSentThisMonth.count ?? 0,
    },
    api: {
      callsThisMonth: apiAgg.calls,
      inputTokens: apiAgg.inputTokens,
      outputTokens: apiAgg.outputTokens,
      costCents: apiAgg.costCents,
    },
    recentActivity: recentActivity.data ?? [],
  })
}
