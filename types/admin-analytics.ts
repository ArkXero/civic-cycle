export type AdminAnalyticsRange = '7d' | '30d' | '90d' | 'all'

export interface AdminAnalyticsResponse {
  as_of: string
  range: AdminAnalyticsRange
  timezone: string
  kpis: {
    meetings: {
      total: number
      imported: number
    }
    processing: {
      succeeded: number
      failed: number
      success_rate: number | null
    }
    users: {
      total: number
      new_users: number
    }
    alerts: {
      active_rules: number
      subscribers: number
      sent: number
      failed: number
      bounced: number
    }
    api: {
      calls: number
      failed_calls: number
      input_tokens: number
      output_tokens: number
      cost_usd_micros: number
    }
    previous: {
      processing_succeeded: number
      processing_failed: number
      new_users: number
      api_calls: number
      api_cost_usd_micros: number
    } | null
  }
  meeting_status: {
    total: number
    pending: number
    processing: number
    failed: number
    summarized: number
    stuck_processing: number
  }
  series: {
    processing: Array<{
      date: string
      succeeded: number
      failed: number
    }>
    users: Array<{
      date: string
      new_users: number
      cumulative: number
    }>
    api: Array<{
      date: string
      calls: number
      failed_calls: number
      input_tokens: number
      output_tokens: number
      cost_usd_micros: number
      meetings: number
    }>
    alerts: Array<{
      date: string
      sent: number
      failed: number
      bounced: number
    }>
  }
  recent_activity: Array<{
    id: number
    action: string
    description: string
    created_at: string
    metadata?: Record<string, unknown> | null
  }>
  data_quality: {
    unknown_pricing_calls: number
  }
}
