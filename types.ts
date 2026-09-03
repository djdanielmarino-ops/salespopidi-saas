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
      barrel_inventory: {
        Row: {
          barrel_model_id: string
          beer_type_id: string | null
          created_at: string
          id: string
          quantity: number
          status: Database["public"]["Enums"]["barrel_status"]
          updated_at: string
        }
        Insert: {
          barrel_model_id: string
          beer_type_id?: string | null
          created_at?: string
          id?: string
          quantity?: number
          status?: Database["public"]["Enums"]["barrel_status"]
          updated_at?: string
        }
        Update: {
          barrel_model_id?: string
          beer_type_id?: string | null
          created_at?: string
          id?: string
          quantity?: number
          status?: Database["public"]["Enums"]["barrel_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "barrel_inventory_barrel_model_id_fkey"
            columns: ["barrel_model_id"]
            isOneToOne: false
            referencedRelation: "barrel_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "barrel_inventory_beer_type_id_fkey"
            columns: ["beer_type_id"]
            isOneToOne: false
            referencedRelation: "beer_types"
            referencedColumns: ["id"]
          },
        ]
      }
      barrel_models: {
        Row: {
          created_at: string
          description: string | null
          id: string
          volume: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          volume: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          volume?: number
        }
        Relationships: []
      }
      beer_types: {
        Row: {
          code: string | null
          cost_per_liter: number | null
          created_at: string
          description: string | null
          id: string
          name: string
          price_per_liter: number | null
        }
        Insert: {
          code?: string | null
          cost_per_liter?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price_per_liter?: number | null
        }
        Update: {
          code?: string | null
          cost_per_liter?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price_per_liter?: number | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          birth_date: string | null
          city: string | null
          cnpj: string | null
          company_name: string | null
          complement: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          cpf: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          neighborhood: string | null
          notes: string | null
          number: string | null
          person_type: string
          phone: string
          rg: string | null
          state: string | null
          state_registration: string | null
          street: string | null
          trade_name: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          birth_date?: string | null
          city?: string | null
          cnpj?: string | null
          company_name?: string | null
          complement?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          person_type?: string
          phone: string
          rg?: string | null
          state?: string | null
          state_registration?: string | null
          street?: string | null
          trade_name?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          birth_date?: string | null
          city?: string | null
          cnpj?: string | null
          company_name?: string | null
          complement?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          neighborhood?: string | null
          notes?: string | null
          number?: string | null
          person_type?: string
          phone?: string
          rg?: string | null
          state?: string | null
          state_registration?: string | null
          street?: string | null
          trade_name?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      cylinder_inventory: {
        Row: {
          created_at: string
          cylinder_model_id: string
          id: string
          quantity: number
          status: Database["public"]["Enums"]["cylinder_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          cylinder_model_id: string
          id?: string
          quantity?: number
          status?: Database["public"]["Enums"]["cylinder_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          cylinder_model_id?: string
          id?: string
          quantity?: number
          status?: Database["public"]["Enums"]["cylinder_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cylinder_inventory_cylinder_model_id_fkey"
            columns: ["cylinder_model_id"]
            isOneToOne: false
            referencedRelation: "cylinder_models"
            referencedColumns: ["id"]
          },
        ]
      }
      cylinder_models: {
        Row: {
          capacity: number
          created_at: string
          description: string | null
          id: string
        }
        Insert: {
          capacity: number
          created_at?: string
          description?: string | null
          id?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          description?: string | null
          id?: string
        }
        Relationships: []
      }
      beer_cost_history: {
        Row: {
          beer_type_id: string
          cost_per_liter: number
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          supplier: string | null
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          beer_type_id: string
          cost_per_liter: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          supplier?: string | null
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          beer_type_id?: string
          cost_per_liter?: number
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          supplier?: string | null
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beer_cost_history_beer_type_id_fkey"
            columns: ["beer_type_id"]
            isOneToOne: false
            referencedRelation: "beer_types"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      cost_entries: {
        Row: {
          amount: number
          category_id: string | null
          cost_date: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_recurring: boolean
          notes: string | null
          supplier: string | null
        }
        Insert: {
          amount: number
          category_id?: string | null
          cost_date: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          supplier?: string | null
        }
        Update: {
          amount?: number
          category_id?: string | null
          cost_date?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_recurring?: boolean
          notes?: string | null
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "cost_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cylinders: {
        Row: {
          code: string
          created_at: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["cylinder_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["cylinder_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["cylinder_status"]
          updated_at?: string
        }
        Relationships: []
      }
      financial_users: {
        Row: {
          created_at: string
          id: string
          password_hash: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          password_hash: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          password_hash?: string
          username?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          barrel_model_id: string | null
          barrel_quantity: number | null
          beer_type_id: string
          consigned_barrel_quantity: number
          consigned_consumed_quantity: number | null
          consigned_resolved_at: string | null
          consigned_returned_quantity: number | null
          created_at: string
          id: string
          order_id: string
          quantity_liters: number
          sold_barrel_quantity: number
          total_cost_at_sale: number
          total_price: number
          unit_cost_at_sale: number
          unit_price: number
        }
        Insert: {
          barrel_model_id?: string | null
          barrel_quantity?: number | null
          beer_type_id: string
          consigned_barrel_quantity?: number
          consigned_consumed_quantity?: number | null
          consigned_resolved_at?: string | null
          consigned_returned_quantity?: number | null
          created_at?: string
          id?: string
          order_id: string
          quantity_liters: number
          sold_barrel_quantity?: number
          total_cost_at_sale?: number
          total_price: number
          unit_cost_at_sale?: number
          unit_price: number
        }
        Update: {
          barrel_model_id?: string | null
          barrel_quantity?: number | null
          beer_type_id?: string
          consigned_barrel_quantity?: number
          consigned_consumed_quantity?: number | null
          consigned_resolved_at?: string | null
          consigned_returned_quantity?: number | null
          created_at?: string
          id?: string
          order_id?: string
          quantity_liters?: number
          sold_barrel_quantity?: number
          total_cost_at_sale?: number
          total_price?: number
          unit_cost_at_sale?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_barrel_model_id_fkey"
            columns: ["barrel_model_id"]
            isOneToOne: false
            referencedRelation: "barrel_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_beer_type_id_fkey"
            columns: ["beer_type_id"]
            isOneToOne: false
            referencedRelation: "beer_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          actual_return_date: string | null
          created_at: string
          customer_id: string
          cylinder_id: string | null
          cylinder_model_id: string | null
          cylinder_quantity: number | null
          delivery_address_city: string | null
          delivery_address_complement: string | null
          delivery_address_neighborhood: string | null
          delivery_address_number: string | null
          delivery_address_state: string | null
          delivery_address_street: string | null
          delivery_address_zip_code: string | null
          delivery_date: string
          delivery_fee: number | null
          delivery_time: string | null
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          discount: number | null
          expected_return_date: string | null
          id: string
          nfe_error_message: string | null
          nfe_issued_at: string | null
          nfe_issued_by: string | null
          nfe_key: string | null
          nfe_last_attempt_at: string | null
          nfe_number: string | null
          nfe_status: Database["public"]["Enums"]["nfe_status"] | null
          notes: string | null
          order_number: number
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number | null
          tap_id: string | null
          total: number | null
          updated_at: string
        }
        Insert: {
          actual_return_date?: string | null
          created_at?: string
          customer_id: string
          cylinder_id?: string | null
          cylinder_model_id?: string | null
          cylinder_quantity?: number | null
          delivery_address_city?: string | null
          delivery_address_complement?: string | null
          delivery_address_neighborhood?: string | null
          delivery_address_number?: string | null
          delivery_address_state?: string | null
          delivery_address_street?: string | null
          delivery_address_zip_code?: string | null
          delivery_date: string
          delivery_fee?: number | null
          delivery_time?: string | null
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          discount?: number | null
          expected_return_date?: string | null
          id?: string
          nfe_error_message?: string | null
          nfe_issued_at?: string | null
          nfe_issued_by?: string | null
          nfe_key?: string | null
          nfe_last_attempt_at?: string | null
          nfe_number?: string | null
          nfe_status?: Database["public"]["Enums"]["nfe_status"] | null
          notes?: string | null
          order_number?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number | null
          tap_id?: string | null
          total?: number | null
          updated_at?: string
        }
        Update: {
          actual_return_date?: string | null
          created_at?: string
          customer_id?: string
          cylinder_id?: string | null
          cylinder_model_id?: string | null
          cylinder_quantity?: number | null
          delivery_address_city?: string | null
          delivery_address_complement?: string | null
          delivery_address_neighborhood?: string | null
          delivery_address_number?: string | null
          delivery_address_state?: string | null
          delivery_address_street?: string | null
          delivery_address_zip_code?: string | null
          delivery_date?: string
          delivery_fee?: number | null
          delivery_time?: string | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          discount?: number | null
          expected_return_date?: string | null
          id?: string
          nfe_error_message?: string | null
          nfe_issued_at?: string | null
          nfe_issued_by?: string | null
          nfe_key?: string | null
          nfe_last_attempt_at?: string | null
          nfe_number?: string | null
          nfe_status?: Database["public"]["Enums"]["nfe_status"] | null
          notes?: string | null
          order_number?: number
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number | null
          tap_id?: string | null
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_cylinder_id_fkey"
            columns: ["cylinder_id"]
            isOneToOne: false
            referencedRelation: "cylinders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_cylinder_model_id_fkey"
            columns: ["cylinder_model_id"]
            isOneToOne: false
            referencedRelation: "cylinder_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_tap_id_fkey"
            columns: ["tap_id"]
            isOneToOne: false
            referencedRelation: "taps"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          order_id: string
          payment_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          order_id: string
          payment_date?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string
          payment_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      tap_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      taps: {
        Row: {
          code: string
          created_at: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["equipment_status"]
          tap_type_id: string | null
          updated_at: string
          voltage: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          tap_type_id?: string | null
          updated_at?: string
          voltage?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          tap_type_id?: string | null
          updated_at?: string
          voltage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "taps_tap_type_id_fkey"
            columns: ["tap_type_id"]
            isOneToOne: false
            referencedRelation: "tap_types"
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
      barrel_status:
        | "cheio_loja"
        | "com_cliente"
        | "vazio_loja"
        | "na_cervejaria"
      cylinder_status: "cheio" | "com_cliente" | "vazio"
      delivery_type: "entrega" | "retirada"
      equipment_status: "disponivel" | "em_uso" | "manutencao"
      nfe_status: "emitindo" | "emitida" | "erro"
      order_status: "agendado" | "em_andamento" | "finalizado" | "cancelado"
      payment_method:
        | "dinheiro"
        | "pix"
        | "cartao_debito"
        | "cartao_credito"
        | "transferencia"
      payment_status: "pendente" | "pago" | "cancelado"
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
    Enums: {
      barrel_status: [
        "cheio_loja",
        "com_cliente",
        "vazio_loja",
        "na_cervejaria",
      ],
      cylinder_status: ["cheio", "com_cliente", "vazio"],
      delivery_type: ["entrega", "retirada"],
      equipment_status: ["disponivel", "em_uso", "manutencao"],
      nfe_status: ["emitindo", "emitida", "erro"],
      order_status: ["agendado", "em_andamento", "finalizado", "cancelado"],
      payment_method: [
        "dinheiro",
        "pix",
        "cartao_debito",
        "cartao_credito",
        "transferencia",
      ],
      payment_status: ["pendente", "pago", "cancelado"],
    },
  },
} as const
