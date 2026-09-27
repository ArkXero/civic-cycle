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
          boarddocs_content_hash: string | null
          boarddocs_last_checked_at: string | null
          boarddocs_results_seen_at: string | null
          boarddocs_refresh_started_at: string | null
          boarddocs_refresh_token: string | null
          boarddocs_refresh_error: string | null
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
          boarddocs_content_hash?: string | null
          boarddocs_last_checked_at?: string | null
          boarddocs_results_seen_at?: string | null
          boarddocs_refresh_started_at?: string | null
          boarddocs_refresh_token?: string | null
          boarddocs_refresh_error?: string | null
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
          boarddocs_content_hash?: string | null
          boarddocs_last_checked_at?: string | null
          boarddocs_results_seen_at?: string | null
          boarddocs_refresh_started_at?: string | null
          boarddocs_refresh_token?: string | null
          boarddocs_refresh_error?: string | null
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
          source_content_hash: string | null
          revision: number
          schema_version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          summary_text: string
          key_decisions?: KeyDecision[]
          action_items?: ActionItem[]
          topics?: string[]
          published?: boolean
          source_content_hash?: string | null
          revision?: number
          schema_version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          summary_text?: string
          key_decisions?: KeyDecision[]
          action_items?: ActionItem[]
          topics?: string[]
          published?: boolean
          source_content_hash?: string | null
          revision?: number
          schema_version?: number
          created_at?: string
          updated_at?: string
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
      agenda_item_motions: {
        Row: {
          id: string
          meeting_id: string
          agenda_item_id: string
          source_ordinal: number
          content_hash: string
          raw_html: string
          raw_motion_text: string
          normalized_motion_text: string
          motion_type: MotionType
          parent_ordinal: number | null
          is_final: boolean
          is_superseded: boolean
          outcome: MotionOutcome
          vote_yes: number | null
          vote_no: number | null
          vote_abstain: number | null
          mover: string | null
          seconder: string | null
          roll_call_yes: string[]
          roll_call_no: string[]
          roll_call_abstain: string[]
          parser_version: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          meeting_id: string
          agenda_item_id: string
          source_ordinal: number
          content_hash: string
          raw_html: string
          raw_motion_text: string
          normalized_motion_text: string
          motion_type: MotionType
          parent_ordinal?: number | null
          is_final?: boolean
          is_superseded?: boolean
          outcome?: MotionOutcome
          vote_yes?: number | null
          vote_no?: number | null
          vote_abstain?: number | null
          mover?: string | null
          seconder?: string | null
          roll_call_yes?: string[]
          roll_call_no?: string[]
          roll_call_abstain?: string[]
          parser_version: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          meeting_id?: string
          agenda_item_id?: string
          source_ordinal?: number
          content_hash?: string
          raw_html?: string
          raw_motion_text?: string
          normalized_motion_text?: string
          motion_type?: MotionType
          parent_ordinal?: number | null
          is_final?: boolean
          is_superseded?: boolean
          outcome?: MotionOutcome
          vote_yes?: number | null
          vote_no?: number | null
          vote_abstain?: number | null
          mover?: string | null
          seconder?: string | null
          roll_call_yes?: string[]
          roll_call_no?: string[]
          roll_call_abstain?: string[]
          parser_version?: string
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
          matched_keyword: string
          sent_at: string
          email_status: 'sent' | 'failed' | 'bounced'
        }
        Insert: {
          id?: string
          user_id: string
          meeting_id: string
          alert_preference_id?: string | null
          matched_keyword: string
          sent_at?: string
          email_status?: 'sent' | 'failed' | 'bounced'
        }
        Update: {
          id?: string
          user_id?: string
          meeting_id?: string
          alert_preference_id?: string | null
          matched_keyword?: string
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
          cost_usd_micros: number
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
          cost_usd_micros?: number
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
          cost_usd_micros?: number
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
      get_admin_dashboard_analytics: {
        Args: { p_range?: string; p_timezone?: string }
        Returns: Json
      }
      replace_agenda_item_motions: {
        Args: { target_meeting_id: string; target_agenda_item_id: string; new_motions: Json }
        Returns: number
      }
      replace_meeting_summary: {
        Args: {
          target_meeting_id: string
          new_summary_text: string
          new_topics: string[]
          new_key_decisions: Json
          new_action_items: Json
          new_source_content_hash: string
          new_schema_version: number
          expected_refresh_token?: string | null
          expected_boarddocs_content_hash?: string | null
        }
        Returns: number
      }
      replace_boarddocs_meeting_content: {
        Args: {
          target_meeting_id: string
          target_refresh_token: string
          new_title: string
          new_meeting_date: string
          new_content_hash: string
          new_transcript_text: string | null
          new_last_checked_at: string
          new_results_seen_at: string | null
          new_agenda_items: Json
        }
        Returns: undefined
      }
      mark_meeting_summary_failure: {
        Args: {
          target_meeting_id: string
          failure_message: string
          expected_refresh_token?: string | null
          expected_boarddocs_content_hash?: string | null
        }
        Returns: boolean
      }
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
      try_begin_boarddocs_refresh: {
        Args: { target_meeting_id: string; lease_seconds?: number }
        Returns: string | null
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
  source_motion_hash?: string | null
  motion_type?: MotionType | null
  outcome?: MotionOutcome | null
  vote_yes: number | null
  vote_no: number | null
  vote_abstain: number | null
}

export type MotionType =
  | 'original'
  | 'main'
  | 'amendment'
  | 'amendment_to_amendment'
  | 'amended_amendment'
  | 'amended_final'
  | 'procedural'
  | 'postponed'
  | 'tabled'
  | 'withdrawn'
  | 'other'

export type MotionOutcome =
  | 'passed'
  | 'failed'
  | 'postponed'
  | 'tabled'
  | 'withdrawn'
  | 'unknown'

export interface ActionItem {
  item: string
  responsible_party: string | null
  deadline: string | null
}
