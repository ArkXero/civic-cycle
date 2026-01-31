export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      meetings: {
        Row: {
          id: string
          title: string
          body: 'FCPS School Board' | 'Board of Supervisors'
          meeting_date: string
          video_url: string | null
          transcript_url: string | null
          transcript_text: string | null
          transcript_source: 'youtube_auto' | 'youtube_manual' | 'manual_upload' | 'whisper' | null
          youtube_video_id: string | null
          youtube_thumbnail_url: string | null
          youtube_duration: string | null
          youtube_published_at: string | null
          status: 'pending' | 'processing' | 'summarized' | 'failed'
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          body: 'FCPS School Board' | 'Board of Supervisors'
          meeting_date: string
          video_url?: string | null
          transcript_url?: string | null
          transcript_text?: string | null
          transcript_source?: 'youtube_auto' | 'youtube_manual' | 'manual_upload' | 'whisper' | null
          youtube_video_id?: string | null
          youtube_thumbnail_url?: string | null
          youtube_duration?: string | null
          youtube_published_at?: string | null
          status?: 'pending' | 'processing' | 'summarized' | 'failed'
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          body?: 'FCPS School Board' | 'Board of Supervisors'
          meeting_date?: string
          video_url?: string | null
          transcript_url?: string | null
          transcript_text?: string | null
          transcript_source?: 'youtube_auto' | 'youtube_manual' | 'manual_upload' | 'whisper' | null
          youtube_video_id?: string | null
          youtube_thumbnail_url?: string | null
          youtube_duration?: string | null
          youtube_published_at?: string | null
          status?: 'pending' | 'processing' | 'summarized' | 'failed'
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      summaries: {
        Row: {
          id: string
          meeting_id: string
          summary_text: string
          key_decisions: KeyDecision[]
          action_items: ActionItem[]
          topics: string[]
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          summary_text: string
          key_decisions?: KeyDecision[]
          action_items?: ActionItem[]
          topics?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          summary_text?: string
          key_decisions?: KeyDecision[]
          action_items?: ActionItem[]
          topics?: string[]
          created_at?: string
        }
      }
      user_profiles: {
        Row: {
          id: string
          email: string
          display_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      alert_preferences: {
        Row: {
          id: string
          user_id: string
          keyword: string
          bodies: string[]
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          keyword: string
          bodies?: string[]
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          keyword?: string
          bodies?: string[]
          is_active?: boolean
          created_at?: string
        }
      }
      alert_history: {
        Row: {
          id: string
          user_id: string
          meeting_id: string
          alert_preference_id: string | null
          sent_at: string
          email_status: 'sent' | 'failed' | 'bounced'
        }
        Insert: {
          id?: string
          user_id: string
          meeting_id: string
          alert_preference_id?: string | null
          sent_at?: string
          email_status?: 'sent' | 'failed' | 'bounced'
        }
        Update: {
          id?: string
          user_id?: string
          meeting_id?: string
          alert_preference_id?: string | null
          sent_at?: string
          email_status?: 'sent' | 'failed' | 'bounced'
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// Helper types for JSONB fields
export interface KeyDecision {
  decision: string
  vote_yes: number
  vote_no: number
  vote_abstain: number
}

export interface ActionItem {
  item: string
  responsible_party: string
  deadline: string
}
