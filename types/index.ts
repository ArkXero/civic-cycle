import type { Database, KeyDecision, ActionItem } from './database'

// Re-export database types
export type { Database, KeyDecision, ActionItem }

// Table row types (for reading data)
export type Meeting = Database['public']['Tables']['meetings']['Row']
export type Summary = Database['public']['Tables']['summaries']['Row']
export type UserProfile = Database['public']['Tables']['user_profiles']['Row']
export type AlertPreference = Database['public']['Tables']['alert_preferences']['Row']
export type AlertHistory = Database['public']['Tables']['alert_history']['Row']

// Insert types (for creating data)
export type MeetingInsert = Database['public']['Tables']['meetings']['Insert']
export type SummaryInsert = Database['public']['Tables']['summaries']['Insert']
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert']
export type AlertPreferenceInsert = Database['public']['Tables']['alert_preferences']['Insert']
export type AlertHistoryInsert = Database['public']['Tables']['alert_history']['Insert']

// Update types (for updating data)
export type MeetingUpdate = Database['public']['Tables']['meetings']['Update']
export type SummaryUpdate = Database['public']['Tables']['summaries']['Update']
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update']
export type AlertPreferenceUpdate = Database['public']['Tables']['alert_preferences']['Update']
export type AlertHistoryUpdate = Database['public']['Tables']['alert_history']['Update']

// Composite types (for joined queries)
export type MeetingWithSummary = Meeting & {
  summary: Summary | null
}

// Meeting body type
export type MeetingBody = 'FCPS School Board' | 'Board of Supervisors'

// Meeting status type
export type MeetingStatus = 'pending' | 'processing' | 'summarized' | 'failed'

// Email status type
export type EmailStatus = 'sent' | 'failed' | 'bounced'

// API response types
export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ApiError {
  error: string
  message: string
  statusCode: number
}
