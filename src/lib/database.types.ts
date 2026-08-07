/**
 * GENERATED FILE — do not edit by hand.
 *
 * Regenerate from the live project (remote-only, see CLAUDE.md) with the
 * Supabase MCP `generate_typescript_types` tool for ref `pjkddahrjjqblexxhaef`,
 * and commit the result. Regenerate after every applied migration: the clients
 * in `src/lib/supabase/*` are parameterised with `Database`, so a stale copy
 * here means `npm run build` is checking your queries against a schema that no
 * longer exists.
 */

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
      item_pesanan: {
        Row: {
          catatan_item: string | null
          diambil_oleh_helper: boolean | null
          dicek_oleh_owner: boolean
          harga_satuan: number
          id: string
          jumlah_diambil: number
          nama_barang: string
          pesanan_id: string
          qty: number
          subtotal: number | null
        }
        Insert: {
          catatan_item?: string | null
          diambil_oleh_helper?: boolean | null
          dicek_oleh_owner?: boolean
          harga_satuan: number
          id?: string
          jumlah_diambil?: number
          nama_barang: string
          pesanan_id: string
          qty: number
          subtotal?: number | null
        }
        Update: {
          catatan_item?: string | null
          diambil_oleh_helper?: boolean | null
          dicek_oleh_owner?: boolean
          harga_satuan?: number
          id?: string
          jumlah_diambil?: number
          nama_barang?: string
          pesanan_id?: string
          qty?: number
          subtotal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_pesanan_pesanan_id_fkey"
            columns: ["pesanan_id"]
            isOneToOne: false
            referencedRelation: "pesanan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_pesanan_pesanan_id_fkey"
            columns: ["pesanan_id"]
            isOneToOne: false
            referencedRelation: "pesanan_unpaid_owner"
            referencedColumns: ["id"]
          },
        ]
      }
      pelanggan: {
        Row: {
          alamat: string | null
          created_at: string | null
          id: string
          nama: string
          telepon: string | null
          tipe: string
        }
        Insert: {
          alamat?: string | null
          created_at?: string | null
          id?: string
          nama: string
          telepon?: string | null
          tipe?: string
        }
        Update: {
          alamat?: string | null
          created_at?: string | null
          id?: string
          nama?: string
          telepon?: string | null
          tipe?: string
        }
        Relationships: []
      }
      pembayaran: {
        Row: {
          catatan: string | null
          dibayar_pada: string
          dicatat_oleh: string
          id: string
          jumlah: number
          metode: string
          pesanan_id: string
        }
        Insert: {
          catatan?: string | null
          dibayar_pada?: string
          dicatat_oleh: string
          id?: string
          jumlah: number
          metode: string
          pesanan_id: string
        }
        Update: {
          catatan?: string | null
          dibayar_pada?: string
          dicatat_oleh?: string
          id?: string
          jumlah?: number
          metode?: string
          pesanan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pembayaran_dicatat_oleh_fkey"
            columns: ["dicatat_oleh"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembayaran_pesanan_id_fkey"
            columns: ["pesanan_id"]
            isOneToOne: false
            referencedRelation: "pesanan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembayaran_pesanan_id_fkey"
            columns: ["pesanan_id"]
            isOneToOne: false
            referencedRelation: "pesanan_unpaid_owner"
            referencedColumns: ["id"]
          },
        ]
      }
      pesanan: {
        Row: {
          catatan: string | null
          colly: number | null
          created_at: string | null
          dibuat_oleh: string
          id: string
          kode_pesanan: string
          nama_pelanggan: string | null
          pelanggan_id: string | null
          pengiriman: string | null
          status: string
          tanggal_pengiriman: string | null
          updated_at: string
        }
        Insert: {
          catatan?: string | null
          colly?: number | null
          created_at?: string | null
          dibuat_oleh: string
          id?: string
          kode_pesanan: string
          nama_pelanggan?: string | null
          pelanggan_id?: string | null
          pengiriman?: string | null
          status?: string
          tanggal_pengiriman?: string | null
          updated_at?: string
        }
        Update: {
          catatan?: string | null
          colly?: number | null
          created_at?: string | null
          dibuat_oleh?: string
          id?: string
          kode_pesanan?: string
          nama_pelanggan?: string | null
          pelanggan_id?: string | null
          pengiriman?: string | null
          status?: string
          tanggal_pengiriman?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pesanan_dibuat_oleh_fkey"
            columns: ["dibuat_oleh"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesanan_pelanggan_id_fkey"
            columns: ["pelanggan_id"]
            isOneToOne: false
            referencedRelation: "pelanggan"
            referencedColumns: ["id"]
          },
        ]
      }
      pesanan_sequence: {
        Row: {
          bulan: number
          tahun: number
          urutan: number
        }
        Insert: {
          bulan: number
          tahun: number
          urutan?: number
        }
        Update: {
          bulan?: number
          tahun?: number
          urutan?: number
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          value: string
        }
        Insert: {
          key: string
          value: string
        }
        Update: {
          key?: string
          value?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          id: string
          nama: string
          role: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id: string
          nama: string
          role: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          nama?: string
          role?: string
        }
        Relationships: []
      }
    }
    Views: {
      item_pesanan_owner: {
        Row: {
          diambil_oleh_helper: boolean | null
          dicek_oleh_owner: boolean | null
          harga_satuan: number | null
          id: string | null
          jumlah_diambil: number | null
          nama_barang: string | null
          pesanan_id: string | null
          qty: number | null
          subtotal: number | null
        }
        Insert: {
          diambil_oleh_helper?: boolean | null
          dicek_oleh_owner?: boolean | null
          harga_satuan?: number | null
          id?: string | null
          jumlah_diambil?: number | null
          nama_barang?: string | null
          pesanan_id?: string | null
          qty?: number | null
          subtotal?: number | null
        }
        Update: {
          diambil_oleh_helper?: boolean | null
          dicek_oleh_owner?: boolean | null
          harga_satuan?: number | null
          id?: string | null
          jumlah_diambil?: number | null
          nama_barang?: string | null
          pesanan_id?: string | null
          qty?: number | null
          subtotal?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "item_pesanan_pesanan_id_fkey"
            columns: ["pesanan_id"]
            isOneToOne: false
            referencedRelation: "pesanan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_pesanan_pesanan_id_fkey"
            columns: ["pesanan_id"]
            isOneToOne: false
            referencedRelation: "pesanan_unpaid_owner"
            referencedColumns: ["id"]
          },
        ]
      }
      pembayaran_owner: {
        Row: {
          catatan: string | null
          dibayar_pada: string | null
          dicatat_oleh: string | null
          id: string | null
          jumlah: number | null
          metode: string | null
          pesanan_id: string | null
        }
        Insert: {
          catatan?: string | null
          dibayar_pada?: string | null
          dicatat_oleh?: string | null
          id?: string | null
          jumlah?: number | null
          metode?: string | null
          pesanan_id?: string | null
        }
        Update: {
          catatan?: string | null
          dibayar_pada?: string | null
          dicatat_oleh?: string | null
          id?: string | null
          jumlah?: number | null
          metode?: string | null
          pesanan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pembayaran_dicatat_oleh_fkey"
            columns: ["dicatat_oleh"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembayaran_pesanan_id_fkey"
            columns: ["pesanan_id"]
            isOneToOne: false
            referencedRelation: "pesanan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pembayaran_pesanan_id_fkey"
            columns: ["pesanan_id"]
            isOneToOne: false
            referencedRelation: "pesanan_unpaid_owner"
            referencedColumns: ["id"]
          },
        ]
      }
      pesanan_unpaid_owner: {
        Row: {
          created_at: string | null
          id: string | null
          kode_pesanan: string | null
          sisa_tagihan: number | null
          total_dibayar: number | null
          total_pesanan: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      clear_all_pelanggan: { Args: never; Returns: number }
      create_pesanan_atomic: {
        Args: {
          p_catatan: string
          p_items: Json
          p_nama_pelanggan: string
          p_pelanggan_id: string
          p_tanggal_pengiriman: string
        }
        Returns: string
      }
      current_user_role: { Args: never; Returns: string }
      dashboard_summary: {
        Args: { p_from: string; p_to: string }
        Returns: {
          period_count: number
          period_revenue: number
          total_piutang: number
          unpaid_count: number
        }[]
      }
      next_kode_pesanan: { Args: never; Returns: string }
      security_posture: { Args: never; Returns: Json }
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
