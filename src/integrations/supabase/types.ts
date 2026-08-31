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
      databases: {
        Row: {
          created_at: string
          edition: string | null
          id: string
          instance_name: string
          oracle_version: string
          owner_id: string | null
          patch_level: string | null
          server_id: string
          sid: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          edition?: string | null
          id?: string
          instance_name: string
          oracle_version: string
          owner_id?: string | null
          patch_level?: string | null
          server_id: string
          sid?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          edition?: string | null
          id?: string
          instance_name?: string
          oracle_version?: string
          owner_id?: string | null
          patch_level?: string | null
          server_id?: string
          sid?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "databases_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "owners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "databases_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      owners: {
        Row: {
          id: string
          name: string
          team: string | null
        }
        Insert: {
          id?: string
          name: string
          team?: string | null
        }
        Update: {
          id?: string
          name?: string
          team?: string | null
        }
        Relationships: []
      }
      resource_metrics: {
        Row: {
          cpu_cores: number
          cpu_usage_percent: number
          database_id: string
          id: string
          ram_allocated_gb: number
          ram_used_gb: number
          recorded_at: string
          storage_allocated_gb: number
          storage_used_gb: number
          tablespace_used_percent: number
        }
        Insert: {
          cpu_cores: number
          cpu_usage_percent: number
          database_id: string
          id?: string
          ram_allocated_gb: number
          ram_used_gb: number
          recorded_at?: string
          storage_allocated_gb: number
          storage_used_gb: number
          tablespace_used_percent: number
        }
        Update: {
          cpu_cores?: number
          cpu_usage_percent?: number
          database_id?: string
          id?: string
          ram_allocated_gb?: number
          ram_used_gb?: number
          recorded_at?: string
          storage_allocated_gb?: number
          storage_used_gb?: number
          tablespace_used_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "resource_metrics_database_id_fkey"
            columns: ["database_id"]
            isOneToOne: false
            referencedRelation: "databases"
            referencedColumns: ["id"]
          },
        ]
      }
      scan_log: {
        Row: {
          id: string
          method: string
          notes: string | null
          scanned_at: string
          server_id: string
          success: boolean
        }
        Insert: {
          id?: string
          method?: string
          notes?: string | null
          scanned_at?: string
          server_id: string
          success?: boolean
        }
        Update: {
          id?: string
          method?: string
          notes?: string | null
          scanned_at?: string
          server_id?: string
          success?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "scan_log_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      servers: {
        Row: {
          created_at: string
          datacenter: string | null
          environment: string
          hostname: string
          id: string
          ip_address: string | null
          os_family: string
          os_version: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          datacenter?: string | null
          environment: string
          hostname: string
          id?: string
          ip_address?: string | null
          os_family: string
          os_version?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          datacenter?: string | null
          environment?: string
          hostname?: string
          id?: string
          ip_address?: string | null
          os_family?: string
          os_version?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      version_history: {
        Row: {
          changed_on: string
          database_id: string
          id: string
          new_version: string
          old_version: string | null
        }
        Insert: {
          changed_on?: string
          database_id: string
          id?: string
          new_version: string
          old_version?: string | null
        }
        Update: {
          changed_on?: string
          database_id?: string
          id?: string
          new_version?: string
          old_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "version_history_database_id_fkey"
            columns: ["database_id"]
            isOneToOne: false
            referencedRelation: "databases"
            referencedColumns: ["id"]
          },
        ]
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
