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
      access_tokens: {
        Row: {
          access_hour: string | null
          blocked_reason: string | null
          created_at: string
          device_id: string | null
          duration_days: number | null
          expires_at: string | null
          id: string
          is_blocked: boolean
          show_name: string | null
          token_code: string
          used_at: string | null
          valid_until: string | null
        }
        Insert: {
          access_hour?: string | null
          blocked_reason?: string | null
          created_at?: string
          device_id?: string | null
          duration_days?: number | null
          expires_at?: string | null
          id?: string
          is_blocked?: boolean
          show_name?: string | null
          token_code: string
          used_at?: string | null
          valid_until?: string | null
        }
        Update: {
          access_hour?: string | null
          blocked_reason?: string | null
          created_at?: string
          device_id?: string | null
          duration_days?: number | null
          expires_at?: string | null
          id?: string
          is_blocked?: boolean
          show_name?: string | null
          token_code?: string
          used_at?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      chat_banned_devices: {
        Row: {
          banned_word: string | null
          created_at: string
          device_id: string
          id: string
          reason: string | null
        }
        Insert: {
          banned_word?: string | null
          created_at?: string
          device_id: string
          id?: string
          reason?: string | null
        }
        Update: {
          banned_word?: string | null
          created_at?: string
          device_id?: string
          id?: string
          reason?: string | null
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          color: string
          created_at: string
          device_id: string | null
          id: string
          nickname: string
          text: string
        }
        Insert: {
          color?: string
          created_at?: string
          device_id?: string | null
          id?: string
          nickname: string
          text: string
        }
        Update: {
          color?: string
          created_at?: string
          device_id?: string | null
          id?: string
          nickname?: string
          text?: string
        }
        Relationships: []
      }
      coin_topup_requests: {
        Row: {
          amount: number
          confirmed_at: string | null
          created_at: string
          id: string
          status: string
          topup_code: string
          total_price: number
          user_id: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          topup_code: string
          total_price: number
          user_id: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          topup_code?: string
          total_price?: number
          user_id?: string
        }
        Relationships: []
      }
      memberships: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price: number
          type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price?: number
          type?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          type?: string
        }
        Relationships: []
      }
      moderators: {
        Row: {
          created_at: string
          device_id: string
          id: string
          nickname: string | null
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: string
          nickname?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: string
          nickname?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          coins: number
          created_at: string
          id: string
          nickname: string
          user_code: string
          user_id: string
        }
        Insert: {
          coins?: number
          created_at?: string
          id?: string
          nickname: string
          user_code: string
          user_id: string
        }
        Update: {
          coins?: number
          created_at?: string
          id?: string
          nickname?: string
          user_code?: string
          user_id?: string
        }
        Relationships: []
      }
      replay_schedules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          replay_password: string
          show_date: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          replay_password: string
          show_date: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          replay_password?: string
          show_date?: string
        }
        Relationships: []
      }
      show_catalog: {
        Row: {
          access_hour: string | null
          background_url: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          lineup: string[] | null
          price_coins: number
          show_date: string | null
          title: string
        }
        Insert: {
          access_hour?: string | null
          background_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          lineup?: string[] | null
          price_coins?: number
          show_date?: string | null
          title: string
        }
        Update: {
          access_hour?: string | null
          background_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          lineup?: string[] | null
          price_coins?: number
          show_date?: string | null
          title?: string
        }
        Relationships: []
      }
      show_purchases: {
        Row: {
          coins_spent: number
          created_at: string
          id: string
          show_id: string
          user_id: string
        }
        Insert: {
          coins_spent: number
          created_at?: string
          id?: string
          show_id: string
          user_id: string
        }
        Update: {
          coins_spent?: number
          created_at?: string
          id?: string
          show_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_purchases_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "show_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      shows: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      stream_settings: {
        Row: {
          access_days: number | null
          background_effect: string | null
          backup_video_url: string | null
          catalog_background_type: string | null
          catalog_background_url: string | null
          channel_avatar: string | null
          channel_avatar_2: string | null
          channel_name: string | null
          countdown_background: string | null
          countdown_datetime: string | null
          id: string
          idn_live_url: string | null
          lineup: Json | null
          logo_url: string | null
          membership_link: string | null
          public_link_enabled: boolean
          replay_password: string | null
          replay_url: string | null
          stream_source_type: string | null
          stream_source_url: string | null
          stream_source_url_2: string | null
          stream_title: string | null
          updated_at: string
          video_id: string | null
        }
        Insert: {
          access_days?: number | null
          background_effect?: string | null
          backup_video_url?: string | null
          catalog_background_type?: string | null
          catalog_background_url?: string | null
          channel_avatar?: string | null
          channel_avatar_2?: string | null
          channel_name?: string | null
          countdown_background?: string | null
          countdown_datetime?: string | null
          id?: string
          idn_live_url?: string | null
          lineup?: Json | null
          logo_url?: string | null
          membership_link?: string | null
          public_link_enabled?: boolean
          replay_password?: string | null
          replay_url?: string | null
          stream_source_type?: string | null
          stream_source_url?: string | null
          stream_source_url_2?: string | null
          stream_title?: string | null
          updated_at?: string
          video_id?: string | null
        }
        Update: {
          access_days?: number | null
          background_effect?: string | null
          backup_video_url?: string | null
          catalog_background_type?: string | null
          catalog_background_url?: string | null
          channel_avatar?: string | null
          channel_avatar_2?: string | null
          channel_name?: string | null
          countdown_background?: string | null
          countdown_datetime?: string | null
          id?: string
          idn_live_url?: string | null
          lineup?: Json | null
          logo_url?: string | null
          membership_link?: string | null
          public_link_enabled?: boolean
          replay_password?: string | null
          replay_url?: string | null
          stream_source_type?: string | null
          stream_source_url?: string | null
          stream_source_url_2?: string | null
          stream_title?: string | null
          updated_at?: string
          video_id?: string | null
        }
        Relationships: []
      }
      viewer_visits: {
        Row: {
          device_id: string
          id: string
          visited_at: string
        }
        Insert: {
          device_id: string
          id?: string
          visited_at?: string
        }
        Update: {
          device_id?: string
          id?: string
          visited_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_user_code: { Args: never; Returns: string }
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
