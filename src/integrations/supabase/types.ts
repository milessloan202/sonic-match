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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      artist_image_cache: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
        }
        Relationships: []
      }
      descriptor_registry: {
        Row: {
          category: string
          conflicts_with: string[]
          created_at: string
          description: string
          id: string
          is_clickable: boolean
          is_public: boolean
          is_seo_enabled: boolean
          label: string
          slug: string
          tier: number
        }
        Insert: {
          category: string
          conflicts_with?: string[]
          created_at?: string
          description: string
          id?: string
          is_clickable?: boolean
          is_public?: boolean
          is_seo_enabled?: boolean
          label: string
          slug: string
          tier?: number
        }
        Update: {
          category?: string
          conflicts_with?: string[]
          created_at?: string
          description?: string
          id?: string
          is_clickable?: boolean
          is_public?: boolean
          is_seo_enabled?: boolean
          label?: string
          slug?: string
          tier?: number
        }
        Relationships: []
      }
      sample_cache: {
        Row: {
          artist_name: string
          created_at: string
          id: string
          looked_up: boolean
          musicbrainz_recording_id: string | null
          sample_verified: boolean
          sampled_artist_name: string | null
          sampled_recording_id: string | null
          sampled_song_title: string | null
          song_title: string
        }
        Insert: {
          artist_name: string
          created_at?: string
          id?: string
          looked_up?: boolean
          musicbrainz_recording_id?: string | null
          sample_verified?: boolean
          sampled_artist_name?: string | null
          sampled_recording_id?: string | null
          sampled_song_title?: string | null
          song_title: string
        }
        Update: {
          artist_name?: string
          created_at?: string
          id?: string
          looked_up?: boolean
          musicbrainz_recording_id?: string | null
          sample_verified?: boolean
          sampled_artist_name?: string | null
          sampled_recording_id?: string | null
          sampled_song_title?: string | null
          song_title?: string
        }
        Relationships: []
      }
      seo_pages: {
        Row: {
          closest_matches: Json | null
          created_at: string
          heading: string
          id: string
          is_indexable: boolean
          meta_description: string | null
          page_type: string
          related_artist_links: Json | null
          related_artists: Json | null
          related_songs: Json | null
          related_vibes: Json | null
          resolved_artist_name: string | null
          resolved_song_title: string | null
          same_energy: Json | null
          slug: string
          spotify_track_id: string | null
          summary: string | null
          title: string
          updated_at: string
          why_these_work: Json | null
        }
        Insert: {
          closest_matches?: Json | null
          created_at?: string
          heading: string
          id?: string
          is_indexable?: boolean
          meta_description?: string | null
          page_type: string
          related_artist_links?: Json | null
          related_artists?: Json | null
          related_songs?: Json | null
          related_vibes?: Json | null
          resolved_artist_name?: string | null
          resolved_song_title?: string | null
          same_energy?: Json | null
          slug: string
          spotify_track_id?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          why_these_work?: Json | null
        }
        Update: {
          closest_matches?: Json | null
          created_at?: string
          heading?: string
          id?: string
          is_indexable?: boolean
          meta_description?: string | null
          page_type?: string
          related_artist_links?: Json | null
          related_artists?: Json | null
          related_songs?: Json | null
          related_vibes?: Json | null
          resolved_artist_name?: string | null
          resolved_song_title?: string | null
          same_energy?: Json | null
          slug?: string
          spotify_track_id?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          why_these_work?: Json | null
        }
        Relationships: []
      }
      song_comparisons: {
        Row: {
          created_at: string
          differences: string[]
          id: string
          long_reason: string
          match_strength: number
          shared_traits: string[]
          short_reason: string
          song_a_id: string
          song_b_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          differences?: string[]
          id?: string
          long_reason?: string
          match_strength?: number
          shared_traits?: string[]
          short_reason?: string
          song_a_id: string
          song_b_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          differences?: string[]
          id?: string
          long_reason?: string
          match_strength?: number
          shared_traits?: string[]
          short_reason?: string
          song_a_id?: string
          song_b_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      song_image_cache: {
        Row: {
          artist: string
          cache_version: number | null
          created_at: string
          expires_at: string | null
          id: string
          image_url: string | null
          last_http_status: number | null
          name: string
          preview_url: string | null
          resolver_status: string | null
          spotify_track_id: string | null
          spotify_url: string | null
          youtube_thumbnail_url: string | null
        }
        Insert: {
          artist: string
          cache_version?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          last_http_status?: number | null
          name: string
          preview_url?: string | null
          resolver_status?: string | null
          spotify_track_id?: string | null
          spotify_url?: string | null
          youtube_thumbnail_url?: string | null
        }
        Update: {
          artist?: string
          cache_version?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          image_url?: string | null
          last_http_status?: number | null
          name?: string
          preview_url?: string | null
          resolver_status?: string | null
          spotify_track_id?: string | null
          spotify_url?: string | null
          youtube_thumbnail_url?: string | null
        }
        Relationships: []
      }
      song_sonic_profiles: {
        Row: {
          artist_name: string
          confidence_score: number
          created_at: string
          descriptor_slugs: string[]
          id: string
          profile_json: Json
          song_title: string
          spotify_track_id: string
          updated_at: string
        }
        Insert: {
          artist_name: string
          confidence_score?: number
          created_at?: string
          descriptor_slugs?: string[]
          id?: string
          profile_json?: Json
          song_title: string
          spotify_track_id: string
          updated_at?: string
        }
        Update: {
          artist_name?: string
          confidence_score?: number
          created_at?: string
          descriptor_slugs?: string[]
          id?: string
          profile_json?: Json
          song_title?: string
          spotify_track_id?: string
          updated_at?: string
        }
        Relationships: []
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
