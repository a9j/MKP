// Generated from the live Supabase project MKP (ref ypdmayocalrybwdurmgs).
// Do not edit by hand. Regenerate after any migration:
//   supabase gen types typescript --project-id ypdmayocalrybwdurmgs
// scripts/gen-types.mjs generates the same shape from a local Postgres,
// for when the live project is not reachable.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      agencies: {
        Row: {
          created_at: string
          id: string
          name: string
          records_officer_email: string | null
          records_officer_name: string | null
          website: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          records_officer_email?: string | null
          records_officer_name?: string | null
          website?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          records_officer_email?: string | null
          records_officer_name?: string | null
          website?: string | null
        }
        Relationships: []
      }
      ai_runs: {
        Row: {
          created_at: string
          id: string
          input_hash: string
          kind: string
          model: string
          prompt_version: string
          raw_response: Json
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          input_hash: string
          kind: string
          model: string
          prompt_version: string
          raw_response?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          input_hash?: string
          kind?: string
          model?: string
          prompt_version?: string
          raw_response?: Json
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      bodies: {
        Row: {
          id: string
          name: string
          slug: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      budget_categories: {
        Row: {
          amount: number
          category: string
          fiscal_year: string
          id: string
          source_url: string
        }
        Insert: {
          amount: number
          category: string
          fiscal_year: string
          id?: string
          source_url: string
        }
        Update: {
          amount?: number
          category?: string
          fiscal_year?: string
          id?: string
          source_url?: string
        }
        Relationships: []
      }
      citations: {
        Row: {
          claim_id: string
          created_at: string
          document_id: string | null
          id: string
          locator: string | null
          page_number: number | null
          quote: string | null
          sort_order: number
          source_url: string | null
        }
        Insert: {
          claim_id: string
          created_at?: string
          document_id?: string | null
          id?: string
          locator?: string | null
          page_number?: number | null
          quote?: string | null
          sort_order?: number
          source_url?: string | null
        }
        Update: {
          claim_id?: string
          created_at?: string
          document_id?: string | null
          id?: string
          locator?: string | null
          page_number?: number | null
          quote?: string | null
          sort_order?: number
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "citations_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "citations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          ai_generated: boolean
          ai_run_id: string | null
          attributed_to: string | null
          created_at: string
          explainer_id: string | null
          id: string
          label: Database["public"]["Enums"]["claim_label"]
          report_id: string | null
          section: Database["public"]["Enums"]["explainer_section"] | null
          sort_order: number
          text: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
          vote_id: string | null
        }
        Insert: {
          ai_generated?: boolean
          ai_run_id?: string | null
          attributed_to?: string | null
          created_at?: string
          explainer_id?: string | null
          id?: string
          label: Database["public"]["Enums"]["claim_label"]
          report_id?: string | null
          section?: Database["public"]["Enums"]["explainer_section"] | null
          sort_order?: number
          text: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          vote_id?: string | null
        }
        Update: {
          ai_generated?: boolean
          ai_run_id?: string | null
          attributed_to?: string | null
          created_at?: string
          explainer_id?: string | null
          id?: string
          label?: Database["public"]["Enums"]["claim_label"]
          report_id?: string | null
          section?: Database["public"]["Enums"]["explainer_section"] | null
          sort_order?: number
          text?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
          vote_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_ai_run_id_fkey"
            columns: ["ai_run_id"]
            isOneToOne: false
            referencedRelation: "ai_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_explainer_id_fkey"
            columns: ["explainer_id"]
            isOneToOne: false
            referencedRelation: "explainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_explainer_id_fkey"
            columns: ["explainer_id"]
            isOneToOne: false
            referencedRelation: "explainers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "votes"
            referencedColumns: ["id"]
          },
        ]
      }
      corrections: {
        Row: {
          correction_date: string
          created_at: string
          explainer_id: string | null
          explainer_version: number | null
          id: string
          page_path: string
          what_changed: string
          why: string
        }
        Insert: {
          correction_date?: string
          created_at?: string
          explainer_id?: string | null
          explainer_version?: number | null
          id?: string
          page_path: string
          what_changed: string
          why: string
        }
        Update: {
          correction_date?: string
          created_at?: string
          explainer_id?: string | null
          explainer_version?: number | null
          id?: string
          page_path?: string
          what_changed?: string
          why?: string
        }
        Relationships: [
          {
            foreignKeyName: "corrections_explainer_id_fkey"
            columns: ["explainer_id"]
            isOneToOne: false
            referencedRelation: "explainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corrections_explainer_id_fkey"
            columns: ["explainer_id"]
            isOneToOne: false
            referencedRelation: "explainers_public"
            referencedColumns: ["id"]
          },
        ]
      }
      coverage_rules: {
        Row: {
          active: boolean
          body_id: string | null
          created_at: string
          description: string
          id: string
          item_type: string | null
          min_amount: number | null
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          body_id?: string | null
          created_at?: string
          description: string
          id?: string
          item_type?: string | null
          min_amount?: number | null
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          body_id?: string | null
          created_at?: string
          description?: string
          id?: string
          item_type?: string | null
          min_amount?: number | null
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coverage_rules_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "bodies"
            referencedColumns: ["id"]
          },
        ]
      }
      cpi: {
        Row: {
          index_value: number
          source_url: string
          year: number
        }
        Insert: {
          index_value: number
          source_url: string
          year: number
        }
        Update: {
          index_value?: number
          source_url?: string
          year?: number
        }
        Relationships: []
      }
      document_pages: {
        Row: {
          document_id: string
          page_number: number
          search: unknown
          text: string
        }
        Insert: {
          document_id: string
          page_number: number
          search?: unknown
          text: string
        }
        Update: {
          document_id?: string
          page_number?: number
          search?: unknown
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_pages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          agency_id: string | null
          body_id: string | null
          capture_method: Database["public"]["Enums"]["capture_method"]
          captured_by: string | null
          created_at: string
          document_date: string | null
          file_name: string
          file_size: number | null
          id: string
          is_publishable: boolean
          meeting_id: string | null
          mime_type: string | null
          owner_id: string | null
          owner_type: Database["public"]["Enums"]["document_owner_type"]
          page_count: number | null
          retrieved_at: string
          sha256: string | null
          source_kind: Database["public"]["Enums"]["source_kind"]
          source_url: string | null
          storage_path: string
          supersedes_id: string | null
          title: string | null
          withheld_reason: string | null
        }
        Insert: {
          agency_id?: string | null
          body_id?: string | null
          capture_method?: Database["public"]["Enums"]["capture_method"]
          captured_by?: string | null
          created_at?: string
          document_date?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          is_publishable?: boolean
          meeting_id?: string | null
          mime_type?: string | null
          owner_id?: string | null
          owner_type: Database["public"]["Enums"]["document_owner_type"]
          page_count?: number | null
          retrieved_at?: string
          sha256?: string | null
          source_kind?: Database["public"]["Enums"]["source_kind"]
          source_url?: string | null
          storage_path: string
          supersedes_id?: string | null
          title?: string | null
          withheld_reason?: string | null
        }
        Update: {
          agency_id?: string | null
          body_id?: string | null
          capture_method?: Database["public"]["Enums"]["capture_method"]
          captured_by?: string | null
          created_at?: string
          document_date?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          is_publishable?: boolean
          meeting_id?: string | null
          mime_type?: string | null
          owner_id?: string | null
          owner_type?: Database["public"]["Enums"]["document_owner_type"]
          page_count?: number | null
          retrieved_at?: string
          sha256?: string | null
          source_kind?: Database["public"]["Enums"]["source_kind"]
          source_url?: string | null
          storage_path?: string
          supersedes_id?: string | null
          title?: string | null
          withheld_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_captured_by_fkey"
            columns: ["captured_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      editorial_events: {
        Row: {
          action: string
          actor_admin_id: string | null
          actor_label: string
          after: Json | null
          before: Json | null
          id: number
          occurred_at: string
          reason: string | null
          row_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_admin_id?: string | null
          actor_label: string
          after?: Json | null
          before?: Json | null
          id?: never
          occurred_at?: string
          reason?: string | null
          row_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_admin_id?: string | null
          actor_label?: string
          after?: Json | null
          before?: Json | null
          id?: never
          occurred_at?: string
          reason?: string | null
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      explainer_versions: {
        Row: {
          change_note: string | null
          explainer_id: string
          published_at: string
          published_by: string | null
          search: unknown
          search_text: string
          snapshot: Json
          version: number
        }
        Insert: {
          change_note?: string | null
          explainer_id: string
          published_at?: string
          published_by?: string | null
          search?: unknown
          search_text?: string
          snapshot: Json
          version: number
        }
        Update: {
          change_note?: string | null
          explainer_id?: string
          published_at?: string
          published_by?: string | null
          search?: unknown
          search_text?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "explainer_versions_explainer_id_fkey"
            columns: ["explainer_id"]
            isOneToOne: false
            referencedRelation: "explainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "explainer_versions_explainer_id_fkey"
            columns: ["explainer_id"]
            isOneToOne: false
            referencedRelation: "explainers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "explainer_versions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
      explainers: {
        Row: {
          ai_draft: boolean
          body_id: string | null
          created_at: string
          created_by: string | null
          current_step: number | null
          decision_date: string | null
          decision_label: string | null
          id: string
          identifier: string | null
          kind: Database["public"]["Enums"]["explainer_kind"]
          last_published_at: string | null
          meeting_id: string | null
          one_sentence: string | null
          process_steps: string[]
          published_at: string | null
          reading_grade: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          stage: Database["public"]["Enums"]["editorial_stage"]
          status: Database["public"]["Enums"]["publish_status"]
          summary_30s: string | null
          title: string
          updated_at: string
          version: number
          vote_id: string | null
        }
        Insert: {
          ai_draft?: boolean
          body_id?: string | null
          created_at?: string
          created_by?: string | null
          current_step?: number | null
          decision_date?: string | null
          decision_label?: string | null
          id?: string
          identifier?: string | null
          kind: Database["public"]["Enums"]["explainer_kind"]
          last_published_at?: string | null
          meeting_id?: string | null
          one_sentence?: string | null
          process_steps?: string[]
          published_at?: string | null
          reading_grade?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          stage?: Database["public"]["Enums"]["editorial_stage"]
          status?: Database["public"]["Enums"]["publish_status"]
          summary_30s?: string | null
          title: string
          updated_at?: string
          version?: number
          vote_id?: string | null
        }
        Update: {
          ai_draft?: boolean
          body_id?: string | null
          created_at?: string
          created_by?: string | null
          current_step?: number | null
          decision_date?: string | null
          decision_label?: string | null
          id?: string
          identifier?: string | null
          kind?: Database["public"]["Enums"]["explainer_kind"]
          last_published_at?: string | null
          meeting_id?: string | null
          one_sentence?: string | null
          process_steps?: string[]
          published_at?: string | null
          reading_grade?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          stage?: Database["public"]["Enums"]["editorial_stage"]
          status?: Database["public"]["Enums"]["publish_status"]
          summary_30s?: string | null
          title?: string
          updated_at?: string
          version?: number
          vote_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "explainers_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "explainers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "explainers_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "explainers_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "explainers_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "votes"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          audience: string | null
          created_at: string
          email: string
          id: string
          kind: Database["public"]["Enums"]["inquiry_kind"]
          message: string | null
          name: string
        }
        Insert: {
          audience?: string | null
          created_at?: string
          email: string
          id?: string
          kind: Database["public"]["Enums"]["inquiry_kind"]
          message?: string | null
          name: string
        }
        Update: {
          audience?: string | null
          created_at?: string
          email?: string
          id?: string
          kind?: Database["public"]["Enums"]["inquiry_kind"]
          message?: string | null
          name?: string
        }
        Relationships: []
      }
      intake_items: {
        Row: {
          body_id: string | null
          captured_via: Database["public"]["Enums"]["capture_method"]
          coverage: Database["public"]["Enums"]["coverage_decision"]
          coverage_rule_id: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_date: string | null
          document_id: string | null
          explainer_id: string | null
          id: string
          item_type: string | null
          meeting_id: string | null
          skip_reason: string | null
          source_url: string | null
          stated_amount: number | null
          title: string
          updated_at: string
          vote_id: string | null
        }
        Insert: {
          body_id?: string | null
          captured_via?: Database["public"]["Enums"]["capture_method"]
          coverage?: Database["public"]["Enums"]["coverage_decision"]
          coverage_rule_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_date?: string | null
          document_id?: string | null
          explainer_id?: string | null
          id?: string
          item_type?: string | null
          meeting_id?: string | null
          skip_reason?: string | null
          source_url?: string | null
          stated_amount?: number | null
          title: string
          updated_at?: string
          vote_id?: string | null
        }
        Update: {
          body_id?: string | null
          captured_via?: Database["public"]["Enums"]["capture_method"]
          coverage?: Database["public"]["Enums"]["coverage_decision"]
          coverage_rule_id?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_date?: string | null
          document_id?: string | null
          explainer_id?: string | null
          id?: string
          item_type?: string | null
          meeting_id?: string | null
          skip_reason?: string | null
          source_url?: string | null
          stated_amount?: number | null
          title?: string
          updated_at?: string
          vote_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_items_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_items_coverage_rule_id_fkey"
            columns: ["coverage_rule_id"]
            isOneToOne: false
            referencedRelation: "coverage_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_items_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_items_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_items_explainer_id_fkey"
            columns: ["explainer_id"]
            isOneToOne: false
            referencedRelation: "explainers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_items_explainer_id_fkey"
            columns: ["explainer_id"]
            isOneToOne: false
            referencedRelation: "explainers_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_items_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_items_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "votes"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          detail: Json
          finished_at: string | null
          id: string
          name: string
          started_at: string
          status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          detail?: Json
          finished_at?: string | null
          id?: string
          name: string
          started_at?: string
          status?: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          detail?: Json
          finished_at?: string | null
          id?: string
          name?: string
          started_at?: string
          status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: []
      }
      listening_points: {
        Row: {
          id: string
          kind: string
          session_id: string
          sort_order: number
          text: string
        }
        Insert: {
          id?: string
          kind: string
          session_id: string
          sort_order?: number
          text: string
        }
        Update: {
          id?: string
          kind?: string
          session_id?: string
          sort_order?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "listening_points_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "listening_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      listening_sessions: {
        Row: {
          attendee_count: number | null
          audience: Database["public"]["Enums"]["listening_audience"]
          created_at: string
          id: string
          published_at: string | null
          session_date: string
          status: Database["public"]["Enums"]["publish_status"]
          summary: string | null
        }
        Insert: {
          attendee_count?: number | null
          audience: Database["public"]["Enums"]["listening_audience"]
          created_at?: string
          id?: string
          published_at?: string | null
          session_date: string
          status?: Database["public"]["Enums"]["publish_status"]
          summary?: string | null
        }
        Update: {
          attendee_count?: number | null
          audience?: Database["public"]["Enums"]["listening_audience"]
          created_at?: string
          id?: string
          published_at?: string | null
          session_date?: string
          status?: Database["public"]["Enums"]["publish_status"]
          summary?: string | null
        }
        Relationships: []
      }
      meetings: {
        Row: {
          agenda_url: string | null
          body_id: string
          created_at: string
          discovered_by: Database["public"]["Enums"]["meeting_discovery"]
          id: string
          kind: Database["public"]["Enums"]["meeting_kind"]
          meeting_date: string
          minutes_url: string | null
          video_url: string | null
        }
        Insert: {
          agenda_url?: string | null
          body_id: string
          created_at?: string
          discovered_by?: Database["public"]["Enums"]["meeting_discovery"]
          id?: string
          kind?: Database["public"]["Enums"]["meeting_kind"]
          meeting_date: string
          minutes_url?: string | null
          video_url?: string | null
        }
        Update: {
          agenda_url?: string | null
          body_id?: string
          created_at?: string
          discovered_by?: Database["public"]["Enums"]["meeting_discovery"]
          id?: string
          kind?: Database["public"]["Enums"]["meeting_kind"]
          meeting_date?: string
          minutes_url?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meetings_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "bodies"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          active: boolean
          bio: string | null
          body_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          photo_path: string | null
          role: Database["public"]["Enums"]["person_role"]
          sort_order: number
          term_end: string | null
          term_start: string | null
          title: string | null
        }
        Insert: {
          active?: boolean
          bio?: string | null
          body_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          photo_path?: string | null
          role: Database["public"]["Enums"]["person_role"]
          sort_order?: number
          term_end?: string | null
          term_start?: string | null
          title?: string | null
        }
        Update: {
          active?: boolean
          bio?: string | null
          body_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          photo_path?: string | null
          role?: Database["public"]["Enums"]["person_role"]
          sort_order?: number
          term_end?: string | null
          term_start?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "bodies"
            referencedColumns: ["id"]
          },
        ]
      }
      records_requests: {
        Row: {
          agency_id: string
          created_at: string
          date_filed: string
          date_responded: string | null
          denial_reason: string | null
          id: string
          request_text: string
          status: Database["public"]["Enums"]["records_request_status"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          date_filed?: string
          date_responded?: string | null
          denial_reason?: string | null
          id?: string
          request_text: string
          status?: Database["public"]["Enums"]["records_request_status"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          date_filed?: string
          date_responded?: string | null
          denial_reason?: string | null
          id?: string
          request_text?: string
          status?: Database["public"]["Enums"]["records_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "records_requests_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      report_sources: {
        Row: {
          id: string
          label: string
          report_id: string
          sort_order: number
          url: string
        }
        Insert: {
          id?: string
          label: string
          report_id: string
          sort_order?: number
          url: string
        }
        Update: {
          id?: string
          label?: string
          report_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_sources_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: string
          preview_token: string
          published_at: string | null
          report_date: string
          slug: string
          status: Database["public"]["Enums"]["publish_status"]
          summary: string | null
          title: string
          type: Database["public"]["Enums"]["report_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          preview_token?: string
          published_at?: string | null
          report_date: string
          slug: string
          status?: Database["public"]["Enums"]["publish_status"]
          summary?: string | null
          title: string
          type: Database["public"]["Enums"]["report_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          preview_token?: string
          published_at?: string | null
          report_date?: string
          slug?: string
          status?: Database["public"]["Enums"]["publish_status"]
          summary?: string | null
          title?: string
          type?: Database["public"]["Enums"]["report_type"]
          updated_at?: string
        }
        Relationships: []
      }
      salary_schedule: {
        Row: {
          district: string
          id: string
          lane: string
          salary: number
          school_year: string
          source_url: string
          step: number
        }
        Insert: {
          district: string
          id?: string
          lane: string
          salary: number
          school_year: string
          source_url: string
          step: number
        }
        Update: {
          district?: string
          id?: string
          lane?: string
          salary?: number
          school_year?: string
          source_url?: string
          step?: number
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          is_public: boolean
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          is_public?: boolean
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          is_public?: boolean
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          confirmed: boolean
          created_at: string
          email: string
          id: string
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      vacancies: {
        Row: {
          as_of_date: string
          building: string | null
          filled_date: string | null
          id: string
          position: string
          posted_date: string | null
          source_url: string
        }
        Insert: {
          as_of_date: string
          building?: string | null
          filled_date?: string | null
          id?: string
          position: string
          posted_date?: string | null
          source_url: string
        }
        Update: {
          as_of_date?: string
          building?: string | null
          filled_date?: string | null
          id?: string
          position?: string
          posted_date?: string | null
          source_url?: string
        }
        Relationships: []
      }
      vacancy_snapshots: {
        Row: {
          as_of_date: string
          created_at: string
          id: string
          row_count: number
          storage_path: string
        }
        Insert: {
          as_of_date: string
          created_at?: string
          id?: string
          row_count?: number
          storage_path: string
        }
        Update: {
          as_of_date?: string
          created_at?: string
          id?: string
          row_count?: number
          storage_path?: string
        }
        Relationships: []
      }
      vote_members: {
        Row: {
          person_id: string
          vote: Database["public"]["Enums"]["vote_choice"]
          vote_id: string
        }
        Insert: {
          person_id: string
          vote: Database["public"]["Enums"]["vote_choice"]
          vote_id: string
        }
        Update: {
          person_id?: string
          vote?: Database["public"]["Enums"]["vote_choice"]
          vote_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vote_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "member_vote_tallies"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "vote_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vote_members_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "votes"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          agenda_item_url: string | null
          ai_confidence: number | null
          ai_draft: boolean
          ai_model: string | null
          amount: number | null
          category: Database["public"]["Enums"]["vote_category"]
          created_at: string
          id: string
          item_title: string
          meeting_id: string
          published_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["publish_status"]
          summary: string
          updated_at: string
        }
        Insert: {
          agenda_item_url?: string | null
          ai_confidence?: number | null
          ai_draft?: boolean
          ai_model?: string | null
          amount?: number | null
          category?: Database["public"]["Enums"]["vote_category"]
          created_at?: string
          id?: string
          item_title: string
          meeting_id: string
          published_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["publish_status"]
          summary: string
          updated_at?: string
        }
        Update: {
          agenda_item_url?: string | null
          ai_confidence?: number | null
          ai_draft?: boolean
          ai_model?: string | null
          amount?: number | null
          category?: Database["public"]["Enums"]["vote_category"]
          created_at?: string
          id?: string
          item_title?: string
          meeting_id?: string
          published_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["publish_status"]
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "votes_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      explainers_public: {
        Row: {
          body_id: string | null
          change_note: string | null
          decision_date: string | null
          decision_label: string | null
          first_published_at: string | null
          id: string | null
          identifier: string | null
          kind: Database["public"]["Enums"]["explainer_kind"] | null
          meeting_id: string | null
          one_sentence: string | null
          search: unknown
          slug: string | null
          snapshot: Json | null
          summary_30s: string | null
          title: string | null
          updated_at: string | null
          version: number | null
          vote_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "explainers_body_id_fkey"
            columns: ["body_id"]
            isOneToOne: false
            referencedRelation: "bodies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "explainers_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "meetings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "explainers_vote_id_fkey"
            columns: ["vote_id"]
            isOneToOne: false
            referencedRelation: "votes"
            referencedColumns: ["id"]
          },
        ]
      }
      latest_feed: {
        Row: {
          date: string | null
          href: string | null
          kind: string | null
          subtitle: string | null
          title: string | null
        }
        Relationships: []
      }
      member_vote_tallies: {
        Row: {
          absent_count: number | null
          abstain_count: number | null
          active: boolean | null
          body_name: string | null
          body_slug: string | null
          name: string | null
          no_count: number | null
          person_id: string | null
          sort_order: number | null
          term_end: string | null
          term_start: string | null
          title: string | null
          votes_cast: number | null
          yes_count: number | null
        }
        Relationships: []
      }
      records_request_log: {
        Row: {
          agency_name: string | null
          date_filed: string | null
          date_responded: string | null
          denial_reason: string | null
          document_count: number | null
          id: string | null
          open_business_days: number | null
          request_text: string | null
          response_business_days: number | null
          status: Database["public"]["Enums"]["records_request_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      build_explainer_snapshot: { Args: { p_id: string }; Returns: Json }
      business_days_between: {
        Args: { end_date: string; start_date: string }
        Returns: number
      }
      explainer_problems: { Args: { p_id: string }; Returns: string[] }
      is_admin: { Args: never; Returns: boolean }
      match_coverage_rule: {
        Args: { p_amount: number; p_body_id: string; p_item_type: string }
        Returns: string
      }
      publish_explainer: {
        Args: { p_change_note?: string; p_id: string }
        Returns: number
      }
    }
    Enums: {
      capture_method: "upload" | "url" | "paste" | "records_request" | "watcher"
      claim_label: "fact" | "estimate" | "argument" | "unknown"
      coverage_decision: "pending" | "cover" | "skip"
      document_owner_type:
        | "records_request"
        | "report"
        | "listening"
        | "template"
        | "meeting"
        | "source"
      editorial_stage:
        | "captured"
        | "ai_draft"
        | "citation_check"
        | "in_review"
        | "approved"
      explainer_kind:
        | "board_item"
        | "contract"
        | "levy"
        | "ordinance"
        | "legislation"
        | "ballot_issue"
        | "other"
      explainer_section:
        | "exists_today"
        | "what_changes"
        | "who_affected"
        | "cost"
        | "supporters_say"
        | "opponents_say"
        | "uncertain"
        | "what_next"
      inquiry_kind: "contact" | "council" | "volunteer" | "briefing"
      job_status: "ok" | "error" | "skipped"
      listening_audience: "teachers" | "parents"
      meeting_discovery: "watcher" | "admin"
      meeting_kind: "regular" | "special"
      person_role: "staff" | "board" | "advisory" | "body_member"
      publish_status: "draft" | "published"
      records_request_status: "filed" | "partial" | "fulfilled" | "denied"
      report_type: "pay_report" | "levy_explainer" | "contract_tracker"
      source_kind:
        | "bill_text"
        | "fiscal_note"
        | "agenda"
        | "meeting_packet"
        | "minutes"
        | "contract"
        | "public_record"
        | "ballot_language"
        | "vote_record"
        | "budget"
        | "salary_schedule"
        | "report"
        | "other"
      vote_category: "money" | "staffing" | "contracts" | "facilities" | "other"
      vote_choice: "yes" | "no" | "abstain" | "absent"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      capture_method: ["upload", "url", "paste", "records_request", "watcher"],
      claim_label: ["fact", "estimate", "argument", "unknown"],
      coverage_decision: ["pending", "cover", "skip"],
      document_owner_type: [
        "records_request",
        "report",
        "listening",
        "template",
        "meeting",
        "source",
      ],
      editorial_stage: [
        "captured",
        "ai_draft",
        "citation_check",
        "in_review",
        "approved",
      ],
      explainer_kind: [
        "board_item",
        "contract",
        "levy",
        "ordinance",
        "legislation",
        "ballot_issue",
        "other",
      ],
      explainer_section: [
        "exists_today",
        "what_changes",
        "who_affected",
        "cost",
        "supporters_say",
        "opponents_say",
        "uncertain",
        "what_next",
      ],
      inquiry_kind: ["contact", "council", "volunteer", "briefing"],
      job_status: ["ok", "error", "skipped"],
      listening_audience: ["teachers", "parents"],
      meeting_discovery: ["watcher", "admin"],
      meeting_kind: ["regular", "special"],
      person_role: ["staff", "board", "advisory", "body_member"],
      publish_status: ["draft", "published"],
      records_request_status: ["filed", "partial", "fulfilled", "denied"],
      report_type: ["pay_report", "levy_explainer", "contract_tracker"],
      source_kind: [
        "bill_text",
        "fiscal_note",
        "agenda",
        "meeting_packet",
        "minutes",
        "contract",
        "public_record",
        "ballot_language",
        "vote_record",
        "budget",
        "salary_schedule",
        "report",
        "other",
      ],
      vote_category: ["money", "staffing", "contracts", "facilities", "other"],
      vote_choice: ["yes", "no", "abstain", "absent"],
    },
  },
} as const
