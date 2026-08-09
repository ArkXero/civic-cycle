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
          body: string
          district_id: 'fairfax' | 'loudoun' | 'prince-william' | 'arlington'
          meeting_date: string
          source_url: string | null
          raw_content: string | null
          transcript_text: string | null
          transcript_source: 'boarddocs' | 'manual_upload' | null
          source: 'boarddocs' | null
          boarddocs_id: string | null
          status: 'pending' | 'processing' | 'summarized' | 'failed'
          error_message: string | null
          digest_sent: boolean
          digest_sent_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          external_id?: string
          title: string
          body: string
          district_id?: 'fairfax' | 'loudoun' | 'prince-william' | 'arlington'
          meeting_date: string
          source_url?: string | null
          raw_content?: string | null
          transcript_text?: string | null
          transcript_source?: 'boarddocs' | 'manual_upload' | null
          source?: 'boarddocs' | null
          boarddocs_id?: string | null
          status?: 'pending' | 'processing' | 'summarized' | 'failed'
          error_message?: string | null
          digest_sent?: boolean
          digest_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          external_id?: string
          title?: string
          body?: string
          district_id?: 'fairfax' | 'loudoun' | 'prince-william' | 'arlington'
          meeting_date?: string
          source_url?: string | null
          raw_content?: string | null
          transcript_text?: string | null
          transcript_source?: 'boarddocs' | 'manual_upload' | null
          source?: 'boarddocs' | null
          boarddocs_id?: string | null
          status?: 'pending' | 'processing' | 'summarized' | 'failed'
          error_message?: string | null
          digest_sent?: boolean
          digest_sent_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
      }
      agenda_items: {
        Row: {
          id: string
          meeting_id: string
          external_id: string
          item_order: string
          category: string
          item_type: string
          title: string
          recommended_action: string
          body_markdown: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          external_id: string
          item_order: string
          category?: string
          item_type?: string
          title: string
          recommended_action?: string
          body_markdown?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          external_id?: string
          item_order?: string
          category?: string
          item_type?: string
          title?: string
          recommended_action?: string
          body_markdown?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      meeting_documents: {
        Row: {
          id: string
          meeting_id: string
          agenda_item_id: string
          external_file_id: string
          title: string
          source_url: string
          checksum_sha256: string | null
          parser_name: string | null
          parser_version: string | null
          extracted_markdown: string | null
          page_count: number | null
          byte_size: number | null
          extraction_status: 'pending' | 'processing' | 'extracted' | 'failed' | 'rejected'
          error_details: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          agenda_item_id: string
          external_file_id: string
          title: string
          source_url: string
          checksum_sha256?: string | null
          parser_name?: string | null
          parser_version?: string | null
          extracted_markdown?: string | null
          page_count?: number | null
          byte_size?: number | null
          extraction_status?: 'pending' | 'processing' | 'extracted' | 'failed' | 'rejected'
          error_details?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          agenda_item_id?: string
          external_file_id?: string
          title?: string
          source_url?: string
          checksum_sha256?: string | null
          parser_name?: string | null
          parser_version?: string | null
          extracted_markdown?: string | null
          page_count?: number | null
          byte_size?: number | null
          extraction_status?: 'pending' | 'processing' | 'extracted' | 'failed' | 'rejected'
          error_details?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          id: string
          slug: string
          display_name: string
          description: string
          parent_id: string | null
          synonyms: string[]
          active: boolean
          taxonomy_version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          slug: string
          display_name: string
          description?: string
          parent_id?: string | null
          synonyms?: string[]
          active?: boolean
          taxonomy_version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          slug?: string
          display_name?: string
          description?: string
          parent_id?: string | null
          synonyms?: string[]
          active?: boolean
          taxonomy_version?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      agenda_item_topics: {
        Row: {
          agenda_item_id: string
          topic_id: string
          confidence: number
          rationale: string
          evidence: Json
          classifier_version: string
          review_status: 'pending' | 'approved' | 'rejected'
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          agenda_item_id: string
          topic_id: string
          confidence: number
          rationale?: string
          evidence?: Json
          classifier_version: string
          review_status?: 'pending' | 'approved' | 'rejected'
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          agenda_item_id?: string
          topic_id?: string
          confidence?: number
          rationale?: string
          evidence?: Json
          classifier_version?: string
          review_status?: 'pending' | 'approved' | 'rejected'
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      meeting_topics: {
        Row: {
          meeting_id: string
          topic_id: string
          assignment_count: number
          max_confidence: number
          generated_at: string
        }
        Insert: {
          meeting_id: string
          topic_id: string
          assignment_count: number
          max_confidence: number
          generated_at?: string
        }
        Update: {
          meeting_id?: string
          topic_id?: string
          assignment_count?: number
          max_confidence?: number
          generated_at?: string
        }
        Relationships: []
      }
      topic_suggestions: {
        Row: {
          id: string
          proposed_slug: string
          proposed_name: string
          rationale: string
          examples: Json
          occurrence_count: number
          review_state: 'pending' | 'approved' | 'rejected' | 'merged'
          merged_topic_id: string | null
          classifier_version: string
          created_at: string
          reviewed_at: string | null
        }
        Insert: {
          id?: string
          proposed_slug: string
          proposed_name: string
          rationale?: string
          examples?: Json
          occurrence_count?: number
          review_state?: 'pending' | 'approved' | 'rejected' | 'merged'
          merged_topic_id?: string | null
          classifier_version: string
          created_at?: string
          reviewed_at?: string | null
        }
        Update: {
          id?: string
          proposed_slug?: string
          proposed_name?: string
          rationale?: string
          examples?: Json
          occurrence_count?: number
          review_state?: 'pending' | 'approved' | 'rejected' | 'merged'
          merged_topic_id?: string | null
          classifier_version?: string
          created_at?: string
          reviewed_at?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          id: string
          email: string
          display_name: string | null
          preferred_district_id: 'fairfax' | 'loudoun' | 'prince-william' | 'arlington' | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          display_name?: string | null
          preferred_district_id?: 'fairfax' | 'loudoun' | 'prince-william' | 'arlington' | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          display_name?: string | null
          preferred_district_id?: 'fairfax' | 'loudoun' | 'prince-william' | 'arlington' | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      alert_preferences: {
        Row: {
          id: string
          user_id: string
          keyword: string
          bodies: string[]
          is_active: boolean
          unsubscribe_token: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          keyword: string
          bodies?: string[]
          is_active?: boolean
          unsubscribe_token?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          keyword?: string
          bodies?: string[]
          is_active?: boolean
          unsubscribe_token?: string
          created_at?: string
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
      digest_subscribers: {
        Row: {
          id: string
          email: string
          user_id: string | null
          district_id: 'fairfax' | 'loudoun' | 'prince-william' | 'arlington'
          subscribed_at: string
          unsubscribe_token: string
          active: boolean
        }
        Insert: {
          id?: string
          email: string
          user_id?: string | null
          district_id?: 'fairfax' | 'loudoun' | 'prince-william' | 'arlington'
          subscribed_at?: string
          unsubscribe_token?: string
          active?: boolean
        }
        Update: {
          id?: string
          email?: string
          user_id?: string | null
          district_id?: 'fairfax' | 'loudoun' | 'prince-william' | 'arlington'
          subscribed_at?: string
          unsubscribe_token?: string
          active?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      replace_meeting_topic_assignments: {
        Args: { target_meeting_id: string; new_assignments: Json }
        Returns: number
      }
      refresh_meeting_topics: {
        Args: { target_meeting_id: string }
        Returns: undefined
      }
      refresh_topic_meeting_rollups: {
        Args: { target_topic_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: 'admin' | 'user'
    }
    CompositeTypes: {
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
