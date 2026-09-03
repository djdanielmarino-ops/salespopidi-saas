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
      barrel_brewery_movements: {
        Row: {
          barrel_model_id: string
          brewery_stock_after: number
          brewery_stock_before: number
          created_at: string
          created_by: string | null
          id: string
          movement_type: Database["public"]["Enums"]["barrel_brewery_movement_type"]
          quantity: number
        }
        Insert: {
          barrel_model_id: string
          brewery_stock_after: number
          brewery_stock_before: number
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: Database["public"]["Enums"]["barrel_brewery_movement_type"]
          quantity: number
        }
        Update: {
          barrel_model_id?: string
          brewery_stock_after?: number
          brewery_stock_before?: number
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: Database["public"]["Enums"]["barrel_brewery_movement_type"]
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "barrel_brewery_movements_barrel_model_id_fkey"
            columns: ["barrel_model_id"]
            isOneToOne: false
            referencedRelation: "barrel_models"
            referencedColumns: ["id"]
          },
        ]
      }
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
      beer_types: {
        Row: {
          code: string | null
          cost_per_liter: number | null
          created_at: string
          description: string | null
          id: string
          name: string
          price_per_liter: number | null
          supplier: string | null
        }
        Insert: {
          code?: string | null
          cost_per_liter?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price_per_liter?: number | null
          supplier?: string | null
        }
        Update: {
          code?: string | null
          cost_per_liter?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price_per_liter?: number | null
          supplier?: string | null
        }
        Relationships: []
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
          account_id: string | null
          amount: number
          category_id: string | null
          cost_date: string
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          is_recurring: boolean
          notes: string | null
          paid_date: string | null
          payment_method_config_id: string | null
          payment_status: string
          supplier: string | null
        }
        Insert: {
          account_id?: string | null
          amount: number
          category_id?: string | null
          cost_date: string
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          id?: string
          is_recurring?: boolean
          notes?: string | null
          paid_date?: string | null
          payment_method_config_id?: string | null
          payment_status?: string
          supplier?: string | null
        }
        Update: {
          account_id?: string | null
          amount?: number
          category_id?: string | null
          cost_date?: string
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          is_recurring?: boolean
          notes?: string | null
          paid_date?: string | null
          payment_method_config_id?: string | null
          payment_status?: string
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cost_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "cost_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cost_entries_payment_method_config_id_fkey"
            columns: ["payment_method_config_id"]
            isOneToOne: false
            referencedRelation: "payment_method_configs"
            referencedColumns: ["id"]
          },
        ]
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
      financial_accounts: {
        Row: {
          account_type: string
          bank_name: string | null
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          notes: string | null
          opening_balance: number
          opening_balance_date: string
          updated_at: string
        }
        Insert: {
          account_type: string
          bank_name?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          opening_balance?: number
          opening_balance_date?: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          bank_name?: string | null
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          opening_balance?: number
          opening_balance_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      financial_transactions: {
        Row: {
          account_id: string
          cost_entry_id: string | null
          created_at: string
          created_by: string | null
          description: string
          effective_date: string
          fee_amount: number
          gross_amount: number
          id: string
          metadata: Json
          net_amount: number
          occurred_at: string
          payment_id: string | null
          status: string
          transaction_type: string
          transfer_group_id: string | null
        }
        Insert: {
          account_id: string
          cost_entry_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          effective_date: string
          fee_amount?: number
          gross_amount: number
          id?: string
          metadata?: Json
          net_amount: number
          occurred_at?: string
          payment_id?: string | null
          status?: string
          transaction_type: string
          transfer_group_id?: string | null
        }
        Update: {
          account_id?: string
          cost_entry_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          effective_date?: string
          fee_amount?: number
          gross_amount?: number
          id?: string
          metadata?: Json
          net_amount?: number
          occurred_at?: string
          payment_id?: string | null
          status?: string
          transaction_type?: string
          transfer_group_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_cost_entry_id_fkey"
            columns: ["cost_entry_id"]
            isOneToOne: true
            referencedRelation: "cost_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
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
      order_product_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          stock_moved_at: string | null
          total_price: number
          unit: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          stock_moved_at?: string | null
          total_price: number
          unit: string
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          stock_moved_at?: string | null
          total_price?: number
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_product_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_product_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
      payment_method_configs: {
        Row: {
          base_method: Database["public"]["Enums"]["payment_method"]
          created_at: string
          default_account_id: string
          fee_fixed: number
          fee_payer: string
          fee_percentage: number
          id: string
          is_active: boolean
          name: string
          settlement_days: number
          updated_at: string
        }
        Insert: {
          base_method: Database["public"]["Enums"]["payment_method"]
          created_at?: string
          default_account_id: string
          fee_fixed?: number
          fee_payer?: string
          fee_percentage?: number
          id?: string
          is_active?: boolean
          name: string
          settlement_days?: number
          updated_at?: string
        }
        Update: {
          base_method?: Database["public"]["Enums"]["payment_method"]
          created_at?: string
          default_account_id?: string
          fee_fixed?: number
          fee_payer?: string
          fee_percentage?: number
          id?: string
          is_active?: boolean
          name?: string
          settlement_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_method_configs_default_account_id_fkey"
            columns: ["default_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          account_id: string | null
          amount: number
          calculated_fee: number
          created_at: string
          deducted_fee: number
          expected_at: string | null
          fee_fixed_snapshot: number
          fee_payer_snapshot: string | null
          fee_percentage_snapshot: number
          id: string
          net_amount: number | null
          notes: string | null
          order_id: string
          payment_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_method_config_id: string | null
          settled_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        Insert: {
          account_id?: string | null
          amount: number
          calculated_fee?: number
          created_at?: string
          deducted_fee?: number
          expected_at?: string | null
          fee_fixed_snapshot?: number
          fee_payer_snapshot?: string | null
          fee_percentage_snapshot?: number
          id?: string
          net_amount?: number | null
          notes?: string | null
          order_id: string
          payment_date?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_method_config_id?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Update: {
          account_id?: string | null
          amount?: number
          calculated_fee?: number
          created_at?: string
          deducted_fee?: number
          expected_at?: string | null
          fee_fixed_snapshot?: number
          fee_payer_snapshot?: string | null
          fee_percentage_snapshot?: number
          id?: string
          net_amount?: number | null
          notes?: string | null
          order_id?: string
          payment_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          payment_method_config_id?: string | null
          settled_at?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_payment_method_config_id_fkey"
            columns: ["payment_method_config_id"]
            isOneToOne: false
            referencedRelation: "payment_method_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      product_inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          notes: string | null
          order_id: string | null
          product_id: string
          quantity: number
          stock_after: number
          stock_before: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          notes?: string | null
          order_id?: string | null
          product_id: string
          quantity: number
          stock_after: number
          stock_before: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          notes?: string | null
          order_id?: string | null
          product_id?: string
          quantity?: number
          stock_after?: number
          stock_before?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_inventory_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          current_cost: number
          id: string
          is_active: boolean
          minimum_stock: number
          name: string
          notes: string | null
          sale_price: number
          sku: string | null
          stock_quantity: number
          track_stock: boolean
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          current_cost?: number
          id?: string
          is_active?: boolean
          minimum_stock?: number
          name: string
          notes?: string | null
          sale_price?: number
          sku?: string | null
          stock_quantity?: number
          track_stock?: boolean
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          current_cost?: number
          id?: string
          is_active?: boolean
          minimum_stock?: number
          name?: string
          notes?: string | null
          sale_price?: number
          sku?: string | null
          stock_quantity?: number
          track_stock?: boolean
          unit?: string
          updated_at?: string
        }
        Relationships: []
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
      user_profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          name: string | null
          permissions: Json
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          name?: string | null
          permissions?: Json
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          name?: string | null
          permissions?: Json
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_product_stock: {
        Args: { p_notes?: string; p_product_id: string; p_quantity: number }
        Returns: undefined
      }
      checkout_order_products: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      create_cost_entry_with_payment: {
        Args: {
          p_account_id: string
          p_amount: number
          p_category_id: string
          p_cost_date: string
          p_description: string
          p_due_date: string
          p_is_recurring: boolean
          p_method_config_id: string
          p_notes: string
          p_paid_date: string
          p_payment_status: string
          p_supplier: string
        }
        Returns: {
          account_id: string | null
          amount: number
          category_id: string | null
          cost_date: string
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          is_recurring: boolean
          notes: string | null
          paid_date: string | null
          payment_method_config_id: string | null
          payment_status: string
          supplier: string | null
        }
        SetofOptions: {
          from: "*"
          to: "cost_entries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_permission: { Args: { permission_key: string }; Returns: boolean }
      is_admin: { Args: { check_user_id?: string }; Returns: boolean }
      receive_barrels_from_brewery: {
        Args: {
          p_barrel_model_id: string
          p_beer_type_id: string
          p_quantity: number
        }
        Returns: undefined
      }
      register_order_payment: {
        Args: {
          p_account_id: string
          p_amount: number
          p_method_config_id: string
          p_notes?: string
          p_order_id: string
        }
        Returns: {
          account_id: string | null
          amount: number
          calculated_fee: number
          created_at: string
          deducted_fee: number
          expected_at: string | null
          fee_fixed_snapshot: number
          fee_payer_snapshot: string | null
          fee_percentage_snapshot: number
          id: string
          net_amount: number | null
          notes: string | null
          order_id: string
          payment_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          payment_method_config_id: string | null
          settled_at: string | null
          status: Database["public"]["Enums"]["payment_status"]
        }
        SetofOptions: {
          from: "*"
          to: "payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reverse_order_products: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      send_barrels_to_brewery: {
        Args: { p_barrel_model_id: string; p_quantity: number }
        Returns: undefined
      }
      transfer_between_accounts: {
        Args: {
          p_amount: number
          p_date: string
          p_description: string
          p_from_account: string
          p_to_account: string
        }
        Returns: string
      }
    }
    Enums: {
      barrel_brewery_movement_type: "received" | "sent"
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
      barrel_brewery_movement_type: ["received", "sent"],
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
