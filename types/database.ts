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
          external_id: string
          title: string
          body: 'FCPS School Board' | 'Board of Supervisors'
          meeting_date: string
          source_url: string | null
          raw_content: string | null
          transcript_text: string | null
          transcript_source: 'boarddocs' | 'manual_upload' | null
          source: 'boarddocs' | null
          boarddocs_id: string | null
          status: 'pending' | 'processing' | 'summarized' | 'failed'
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          external_id?: string
          title: string
          body: 'FCPS School Board' | 'Board of Supervisors'
          meeting_date: string
          source_url?: string | null
          raw_content?: string | null
          transcript_text?: string | null
          transcript_source?: 'boarddocs' | 'manual_upload' | null
          source?: 'boarddocs' | null
          boarddocs_id?: string | null
          status?: 'pending' | 'processing' | 'summarized' | 'failed'
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          external_id?: string
          title?: string
          body?: 'FCPS School Board' | 'Board of Supervisors'
          meeting_date?: string
          source_url?: string | null
          raw_content?: string | null
          transcript_text?: string | null
          transcript_source?: 'boarddocs' | 'manual_upload' | null
          source?: 'boarddocs' | null
          boarddocs_id?: string | null
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
          published: boolean
          created_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          summary_text: string
          key_decisions?: KeyDecision[]
          action_items?: ActionItem[]
          topics?: string[]
          published?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          summary_text?: string
          key_decisions?: KeyDecision[]
          action_items?: ActionItem[]
          topics?: string[]
          published?: boolean
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
      activity_logs: {
        Row: {
          id: number
          action: string
          description: string
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: number
          action: string
          description: string
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: number
          action?: string
          description?: string
          metadata?: Json | null
          created_at?: string
        }
      }
      api_usage: {
        Row: {
          id: number
          meeting_id: string | null
          model: string
          input_tokens: number
          output_tokens: number
          cost_cents: number
          success: boolean
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: number
          meeting_id?: string | null
          model: string
          input_tokens: number
          output_tokens: number
          cost_cents: number
          success?: boolean
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          meeting_id?: string | null
          model?: string
          input_tokens?: number
          output_tokens?: number
          cost_cents?: number
          success?: boolean
          error_message?: string | null
          created_at?: string
        }
      }
      user_roles: {
        Row: {
          id: number
          user_id: string
          role: 'admin' | 'user'
          created_at: string
        }
        Insert: {
          id?: number
          user_id: string
          role?: 'admin' | 'user'
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          role?: 'admin' | 'user'
          created_at?: string
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
      app_role: 'admin' | 'user'
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
