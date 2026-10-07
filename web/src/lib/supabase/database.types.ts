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
      app_users: {
        Row: {
          auth_id: string | null
          created_at: string
          created_by: number | null
          email: string | null
          full_name: string
          id: number
          is_active: boolean
          metadata: Json
          phone: string
          updated_at: string
          updated_by: number | null
          username: string
        }
        Insert: {
          auth_id?: string | null
          created_at?: string
          created_by?: number | null
          email?: string | null
          full_name: string
          id?: number
          is_active?: boolean
          metadata?: Json
          phone?: string
          updated_at?: string
          updated_by?: number | null
          username: string
        }
        Update: {
          auth_id?: string | null
          created_at?: string
          created_by?: number | null
          email?: string | null
          full_name?: string
          id?: number
          is_active?: boolean
          metadata?: Json
          phone?: string
          updated_at?: string
          updated_by?: number | null
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_users_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      arrival_items: {
        Row: {
          batch_id: number
          batch_product_id: number
          confirmed: boolean
          confirmed_qty: number
          created_at: string
          created_by: number | null
          id: number
          product_id: number
          received_qty: number
          requested_qty: number
          sent_to_shipping: boolean
          shop_id: string
          status: string
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          batch_id: number
          batch_product_id: number
          confirmed?: boolean
          confirmed_qty?: number
          created_at?: string
          created_by?: number | null
          id?: number
          product_id: number
          received_qty?: number
          requested_qty?: number
          sent_to_shipping?: boolean
          shop_id: string
          status?: string
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          batch_id?: number
          batch_product_id?: number
          confirmed?: boolean
          confirmed_qty?: number
          created_at?: string
          created_by?: number | null
          id?: number
          product_id?: number
          received_qty?: number
          requested_qty?: number
          sent_to_shipping?: boolean
          shop_id?: string
          status?: string
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "arrival_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrival_items_batch_product_id_fkey"
            columns: ["batch_product_id"]
            isOneToOne: false
            referencedRelation: "batch_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrival_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrival_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrival_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arrival_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_user_id: number | null
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity_id: number | null
          entity_table: string
          entity_uuid: string | null
          id: number
          metadata: Json
          shop_id: string
        }
        Insert: {
          action: string
          actor_user_id?: number | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: number | null
          entity_table: string
          entity_uuid?: string | null
          id?: number
          metadata?: Json
          shop_id: string
        }
        Update: {
          action?: string
          actor_user_id?: number | null
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity_id?: number | null
          entity_table?: string
          entity_uuid?: string | null
          id?: number
          metadata?: Json
          shop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_product_shipping: {
        Row: {
          batch_id: number
          batch_product_id: number
          created_at: string
          created_by: number | null
          fee_per_item: number
          id: number
          product_id: number
          shop_id: string
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          batch_id: number
          batch_product_id: number
          created_at?: string
          created_by?: number | null
          fee_per_item?: number
          id?: number
          product_id: number
          shop_id: string
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          batch_id?: number
          batch_product_id?: number
          created_at?: string
          created_by?: number | null
          fee_per_item?: number
          id?: number
          product_id?: number
          shop_id?: string
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_product_shipping_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_product_shipping_batch_product_id_fkey"
            columns: ["batch_product_id"]
            isOneToOne: false
            referencedRelation: "batch_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_product_shipping_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_product_shipping_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_product_shipping_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_product_shipping_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_products: {
        Row: {
          batch_id: number
          created_at: string
          created_by: number | null
          id: number
          in_stock_qty: number
          preorder_discount_min_qty: number
          preorder_discount_price: number
          preorder_price: number
          product_id: number
          shop_id: string
          stock_discount_min_qty: number
          stock_discount_price: number
          stock_price: number
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          batch_id: number
          created_at?: string
          created_by?: number | null
          id?: number
          in_stock_qty?: number
          preorder_discount_min_qty?: number
          preorder_discount_price?: number
          preorder_price?: number
          product_id: number
          shop_id: string
          stock_discount_min_qty?: number
          stock_discount_price?: number
          stock_price?: number
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          batch_id?: number
          created_at?: string
          created_by?: number | null
          id?: number
          in_stock_qty?: number
          preorder_discount_min_qty?: number
          preorder_discount_price?: number
          preorder_price?: number
          product_id?: number
          shop_id?: string
          stock_discount_min_qty?: number
          stock_discount_price?: number
          stock_price?: number
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batch_products_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_products_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      batches: {
        Row: {
          arrivals_sent: boolean
          buying_status: string
          closed_at: string | null
          created_at: string
          created_by: number | null
          delivery_status: string
          id: number
          name: string
          opened_at: string
          order_status: string
          shop_id: string
          status: string
          stock_applied: boolean
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          arrivals_sent?: boolean
          buying_status?: string
          closed_at?: string | null
          created_at?: string
          created_by?: number | null
          delivery_status?: string
          id?: number
          name: string
          opened_at?: string
          order_status?: string
          shop_id: string
          status?: string
          stock_applied?: boolean
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          arrivals_sent?: boolean
          buying_status?: string
          closed_at?: string | null
          created_at?: string
          created_by?: number | null
          delivery_status?: string
          id?: number
          name?: string
          opened_at?: string
          order_status?: string
          shop_id?: string
          status?: string
          stock_applied?: boolean
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      buying_list: {
        Row: {
          batch_id: number
          batch_product_id: number
          created_at: string
          created_by: number | null
          id: number
          in_stock_qty: number
          moved_to_arrivals: boolean
          order_count: number
          ordered_qty: number
          product_id: number
          requested_qty: number
          shop_id: string
          source: string
          status: string
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          batch_id: number
          batch_product_id: number
          created_at?: string
          created_by?: number | null
          id?: number
          in_stock_qty?: number
          moved_to_arrivals?: boolean
          order_count?: number
          ordered_qty?: number
          product_id: number
          requested_qty?: number
          shop_id: string
          source?: string
          status?: string
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          batch_id?: number
          batch_product_id?: number
          created_at?: string
          created_by?: number | null
          id?: number
          in_stock_qty?: number
          moved_to_arrivals?: boolean
          order_count?: number
          ordered_qty?: number
          product_id?: number
          requested_qty?: number
          shop_id?: string
          source?: string
          status?: string
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "buying_list_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buying_list_batch_product_id_fkey"
            columns: ["batch_product_id"]
            isOneToOne: false
            referencedRelation: "batch_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buying_list_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buying_list_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buying_list_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buying_list_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          created_by: number | null
          id: number
          name: string
          notes: string | null
          phone: string | null
          shop_id: string
          updated_at: string
          updated_by: number | null
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: number | null
          id?: number
          name: string
          notes?: string | null
          phone?: string | null
          shop_id: string
          updated_at?: string
          updated_by?: number | null
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: number | null
          id?: number
          name?: string
          notes?: string | null
          phone?: string | null
          shop_id?: string
          updated_at?: string
          updated_by?: number | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      damage_order_allocations: {
        Row: {
          adjusted_quantity: number
          arrival_item_id: number | null
          batch_id: number | null
          batch_name: string
          batch_product_id: number | null
          client_id: number
          created_at: string
          created_by: number | null
          damaged_item_id: number | null
          damaged_quantity: number
          id: number
          is_active: boolean
          notes: string | null
          order_item_id: number | null
          original_quantity: number
          product_id: number
          reason: string | null
          shop_id: string
          undone_at: string | null
          undone_by: number | null
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          adjusted_quantity?: number
          arrival_item_id?: number | null
          batch_id?: number | null
          batch_name?: string
          batch_product_id?: number | null
          client_id: number
          created_at?: string
          created_by?: number | null
          damaged_item_id?: number | null
          damaged_quantity?: number
          id?: number
          is_active?: boolean
          notes?: string | null
          order_item_id?: number | null
          original_quantity?: number
          product_id: number
          reason?: string | null
          shop_id: string
          undone_at?: string | null
          undone_by?: number | null
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          adjusted_quantity?: number
          arrival_item_id?: number | null
          batch_id?: number | null
          batch_name?: string
          batch_product_id?: number | null
          client_id?: number
          created_at?: string
          created_by?: number | null
          damaged_item_id?: number | null
          damaged_quantity?: number
          id?: number
          is_active?: boolean
          notes?: string | null
          order_item_id?: number | null
          original_quantity?: number
          product_id?: number
          reason?: string | null
          shop_id?: string
          undone_at?: string | null
          undone_by?: number | null
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: []
      }
      damaged_items: {
        Row: {
          batch_id: number
          batch_name: string | null
          batch_product_id: number
          created_at: string
          created_by: number | null
          damaged_qty: number
          id: number
          notes: string | null
          product_id: number
          reason: string
          requested_qty: number
          shop_id: string
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          batch_id: number
          batch_name?: string | null
          batch_product_id: number
          created_at?: string
          created_by?: number | null
          damaged_qty?: number
          id?: number
          notes?: string | null
          product_id: number
          reason?: string
          requested_qty?: number
          shop_id: string
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          batch_id?: number
          batch_name?: string | null
          batch_product_id?: number
          created_at?: string
          created_by?: number | null
          damaged_qty?: number
          id?: number
          notes?: string | null
          product_id?: number
          reason?: string
          requested_qty?: number
          shop_id?: string
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "damaged_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damaged_items_batch_product_id_fkey"
            columns: ["batch_product_id"]
            isOneToOne: false
            referencedRelation: "batch_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damaged_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damaged_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damaged_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "damaged_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          batch_id: number
          batch_name: string
          created_at: string
          created_by: number | null
          customer_id: number
          delivery_date: string | null
          delivery_fee: number
          delivery_item_status: string
          delivery_type: string
          id: number
          notes: string | null
          shipping_invoice_id: number | null
          shop_id: string
          status: string
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          batch_id: number
          batch_name: string
          created_at?: string
          created_by?: number | null
          customer_id: number
          delivery_date?: string | null
          delivery_fee?: number
          delivery_item_status?: string
          delivery_type?: string
          id?: number
          notes?: string | null
          shipping_invoice_id?: number | null
          shop_id: string
          status?: string
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          batch_id?: number
          batch_name?: string
          created_at?: string
          created_by?: number | null
          customer_id?: number
          delivery_date?: string | null
          delivery_fee?: number
          delivery_item_status?: string
          delivery_type?: string
          id?: number
          notes?: string | null
          shipping_invoice_id?: number | null
          shop_id?: string
          status?: string
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_shipping_invoice_id_fkey"
            columns: ["shipping_invoice_id"]
            isOneToOne: false
            referencedRelation: "shipping_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by: number | null
          expense_date: string
          id: number
          name: string
          notes: string | null
          shop_id: string
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: number | null
          expense_date?: string
          id?: number
          name: string
          notes?: string | null
          shop_id: string
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by?: number | null
          expense_date?: string
          id?: number
          name?: string
          notes?: string | null
          shop_id?: string
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          batch_id: number
          batch_product_id: number
          created_at: string
          created_by: number | null
          id: number
          notes: string | null
          outstanding_qty: number
          product_id: number
          reason: string
          requested_qty: number
          shop_id: string
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          batch_id: number
          batch_product_id: number
          created_at?: string
          created_by?: number | null
          id?: number
          notes?: string | null
          outstanding_qty?: number
          product_id: number
          reason?: string
          requested_qty?: number
          shop_id: string
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          batch_id?: number
          batch_product_id?: number
          created_at?: string
          created_by?: number | null
          id?: number
          notes?: string | null
          outstanding_qty?: number
          product_id?: number
          reason?: string
          requested_qty?: number
          shop_id?: string
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_batch_product_id_fkey"
            columns: ["batch_product_id"]
            isOneToOne: false
            referencedRelation: "batch_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          batch_product_id: number
          created_by: number | null
          discount_applied: boolean
          id: number
          order_id: number
          product_id: number
          quantity: number
          shop_id: string
          subtotal: number
          unit_price: number
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          batch_product_id: number
          created_by?: number | null
          discount_applied?: boolean
          id?: number
          order_id: number
          product_id: number
          quantity?: number
          shop_id: string
          subtotal?: number
          unit_price?: number
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          batch_product_id?: number
          created_by?: number | null
          discount_applied?: boolean
          id?: number
          order_id?: number
          product_id?: number
          quantity?: number
          shop_id?: string
          subtotal?: number
          unit_price?: number
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_batch_product_id_fkey"
            columns: ["batch_product_id"]
            isOneToOne: false
            referencedRelation: "batch_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          batch_id: number
          created_at: string
          created_by: number | null
          customer_id: number
          id: number
          notes: string | null
          order_uuid: string
          payment_status: string
          refunded: boolean
          shop_id: string
          total: number
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          batch_id: number
          created_at?: string
          created_by?: number | null
          customer_id: number
          id?: number
          notes?: string | null
          order_uuid?: string
          payment_status?: string
          refunded?: boolean
          shop_id: string
          total?: number
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          batch_id?: number
          created_at?: string
          created_by?: number | null
          customer_id?: number
          id?: number
          notes?: string | null
          order_uuid?: string
          payment_status?: string
          refunded?: boolean
          shop_id?: string
          total?: number
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tracking: {
        Row: {
          batch_id: number
          batch_product_id: number
          cbm: number
          created_at: string
          created_by: number | null
          id: number
          measurements: string | null
          moq: number
          product_id: number
          shop_id: string
          tracking_number: string | null
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          batch_id: number
          batch_product_id: number
          cbm?: number
          created_at?: string
          created_by?: number | null
          id?: number
          measurements?: string | null
          moq?: number
          product_id: number
          shop_id: string
          tracking_number?: string | null
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          batch_id?: number
          batch_product_id?: number
          cbm?: number
          created_at?: string
          created_by?: number | null
          id?: number
          measurements?: string | null
          moq?: number
          product_id?: number
          shop_id?: string
          tracking_number?: string | null
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_tracking_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tracking_batch_product_id_fkey"
            columns: ["batch_product_id"]
            isOneToOne: false
            referencedRelation: "batch_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tracking_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tracking_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tracking_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tracking_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          created_by: number | null
          description: string | null
          id: number
          image_url: string | null
          is_active: boolean
          name: string
          preorder_price: number
          purchase_price: number
          shop_id: string
          sku: string | null
          stock: number
          stock_discount_min_qty: number
          stock_discount_price: number
          stock_price: number
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          created_at?: string
          created_by?: number | null
          description?: string | null
          id?: number
          image_url?: string | null
          is_active?: boolean
          name: string
          preorder_price?: number
          purchase_price?: number
          shop_id: string
          sku?: string | null
          stock?: number
          stock_discount_min_qty?: number
          stock_discount_price?: number
          stock_price?: number
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          created_at?: string
          created_by?: number | null
          description?: string | null
          id?: number
          image_url?: string | null
          is_active?: boolean
          name?: string
          preorder_price?: number
          purchase_price?: number
          shop_id?: string
          sku?: string | null
          stock?: number
          stock_discount_min_qty?: number
          stock_discount_price?: number
          stock_price?: number
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_codes: {
        Row: {
          code: string
          code_normalized: string
          created_at: string
          description: string | null
          discount_percent: number | null
          expires_at: string | null
          extra_promo_days: number
          id: string
          is_active: boolean
          max_redemptions: number | null
          plan_override: string | null
          redeemed_count: number
          starts_at: string
          updated_at: string
        }
        Insert: {
          code: string
          code_normalized: string
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          expires_at?: string | null
          extra_promo_days?: number
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          plan_override?: string | null
          redeemed_count?: number
          starts_at?: string
          updated_at?: string
        }
        Update: {
          code?: string
          code_normalized?: string
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          expires_at?: string | null
          extra_promo_days?: number
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          plan_override?: string | null
          redeemed_count?: number
          starts_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          arrivals_config: Json | null
          buying_list_config: Json | null
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          created_by: number | null
          dashboard_config: Json | null
          id: number
          manage_batches_config: Json | null
          orders_config: Json | null
          product_config: Json | null
          resource: string
          role_id: number
          roles_config: Json | null
          shipping_config: Json | null
          shipping_ledger_config: Json | null
          shop_id: string
          stock_sales_config: Json | null
          updated_at: string
          updated_by: number | null
          users_config: Json | null
        }
        Insert: {
          arrivals_config?: Json | null
          buying_list_config?: Json | null
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          created_by?: number | null
          dashboard_config?: Json | null
          id?: number
          manage_batches_config?: Json | null
          orders_config?: Json | null
          product_config?: Json | null
          resource: string
          role_id: number
          roles_config?: Json | null
          shipping_config?: Json | null
          shipping_ledger_config?: Json | null
          shop_id: string
          stock_sales_config?: Json | null
          updated_at?: string
          updated_by?: number | null
          users_config?: Json | null
        }
        Update: {
          arrivals_config?: Json | null
          buying_list_config?: Json | null
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          created_by?: number | null
          dashboard_config?: Json | null
          id?: number
          manage_batches_config?: Json | null
          orders_config?: Json | null
          product_config?: Json | null
          resource?: string
          role_id?: number
          roles_config?: Json | null
          shipping_config?: Json | null
          shipping_ledger_config?: Json | null
          shop_id?: string
          stock_sales_config?: Json | null
          updated_at?: string
          updated_by?: number | null
          users_config?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          created_by: number | null
          description: string | null
          id: number
          is_system: boolean
          name: string
          shop_id: string
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          created_at?: string
          created_by?: number | null
          description?: string | null
          id?: number
          is_system?: boolean
          name: string
          shop_id: string
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          created_at?: string
          created_by?: number | null
          description?: string | null
          id?: number
          is_system?: boolean
          name?: string
          shop_id?: string
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roles_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_batches: {
        Row: {
          batch_id: number | null
          batch_name: string
          created_at: string
          created_by: number | null
          id: number
          shop_id: string
          total_fee: number
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          batch_id?: number | null
          batch_name: string
          created_at?: string
          created_by?: number | null
          id?: number
          shop_id: string
          total_fee?: number
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          batch_id?: number | null
          batch_name?: string
          created_at?: string
          created_by?: number | null
          id?: number
          shop_id?: string
          total_fee?: number
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_batches_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_batches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_batches_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_batches_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_fees: {
        Row: {
          batch_id: number | null
          batch_name: string
          batch_product_id: number | null
          client_id: number | null
          created_at: string
          created_by: number | null
          delivery_id: number | null
          fee: number
          id: number
          product_id: number | null
          product_name: string
          quantity: number
          shop_id: string
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          batch_id?: number | null
          batch_name: string
          batch_product_id?: number | null
          client_id?: number | null
          created_at?: string
          created_by?: number | null
          delivery_id?: number | null
          fee?: number
          id?: number
          product_id?: number | null
          product_name: string
          quantity?: number
          shop_id: string
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          batch_id?: number | null
          batch_name?: string
          batch_product_id?: number | null
          client_id?: number | null
          created_at?: string
          created_by?: number | null
          delivery_id?: number | null
          fee?: number
          id?: number
          product_id?: number | null
          product_name?: string
          quantity?: number
          shop_id?: string
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_fees_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_fees_batch_product_id_fkey"
            columns: ["batch_product_id"]
            isOneToOne: false
            referencedRelation: "batch_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_fees_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_fees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_fees_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_fees_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_fees_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_invoice_items: {
        Row: {
          batch_product_id: number
          created_by: number | null
          fee_per_item: number
          id: number
          product_id: number
          quantity: number
          shipping_invoice_id: number
          shop_id: string
          total_fee: number
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          batch_product_id: number
          created_by?: number | null
          fee_per_item?: number
          id?: number
          product_id: number
          quantity?: number
          shipping_invoice_id: number
          shop_id: string
          total_fee?: number
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          batch_product_id?: number
          created_by?: number | null
          fee_per_item?: number
          id?: number
          product_id?: number
          quantity?: number
          shipping_invoice_id?: number
          shop_id?: string
          total_fee?: number
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_invoice_items_batch_product_id_fkey"
            columns: ["batch_product_id"]
            isOneToOne: false
            referencedRelation: "batch_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_invoice_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_invoice_items_shipping_invoice_id_fkey"
            columns: ["shipping_invoice_id"]
            isOneToOne: false
            referencedRelation: "shipping_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_invoice_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_invoice_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_invoices: {
        Row: {
          batch_id: number
          created_at: string
          created_by: number | null
          customer_id: number
          id: number
          shop_id: string
          status: string
          total_expected: number
          total_paid: number
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          batch_id: number
          created_at?: string
          created_by?: number | null
          customer_id: number
          id?: number
          shop_id: string
          status?: string
          total_expected?: number
          total_paid?: number
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          batch_id?: number
          created_at?: string
          created_by?: number | null
          customer_id?: number
          id?: number
          shop_id?: string
          status?: string
          total_expected?: number
          total_paid?: number
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_invoices_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_invoices_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_invoices_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_payments: {
        Row: {
          batch_id: number | null
          batch_name: string
          client_id: number | null
          created_at: string
          created_by: number | null
          delivery_id: number | null
          id: number
          paid_amount: number
          shop_id: string
          status: string
          total_fee: number
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          batch_id?: number | null
          batch_name: string
          client_id?: number | null
          created_at?: string
          created_by?: number | null
          delivery_id?: number | null
          id?: number
          paid_amount?: number
          shop_id: string
          status?: string
          total_fee?: number
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          batch_id?: number | null
          batch_name?: string
          client_id?: number | null
          created_at?: string
          created_by?: number | null
          delivery_id?: number | null
          id?: number
          paid_amount?: number
          shop_id?: string
          status?: string
          total_fee?: number
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_payments_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_payments_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_payments_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_memberships: {
        Row: {
          accepted_at: string | null
          app_user_id: number | null
          auth_user_id: string
          created_at: string
          created_by: number | null
          id: number
          invited_at: string | null
          invited_by: number | null
          is_active: boolean
          is_owner: boolean
          last_selected_at: string | null
          membership_status: string
          role_id: number | null
          shop_id: string
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          accepted_at?: string | null
          app_user_id?: number | null
          auth_user_id: string
          created_at?: string
          created_by?: number | null
          id?: number
          invited_at?: string | null
          invited_by?: number | null
          is_active?: boolean
          is_owner?: boolean
          last_selected_at?: string | null
          membership_status?: string
          role_id?: number | null
          shop_id: string
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          accepted_at?: string | null
          app_user_id?: number | null
          auth_user_id?: string
          created_at?: string
          created_by?: number | null
          id?: number
          invited_at?: string | null
          invited_by?: number | null
          is_active?: boolean
          is_owner?: boolean
          last_selected_at?: string | null
          membership_status?: string
          role_id?: number | null
          shop_id?: string
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shop_memberships_app_user_id_fkey"
            columns: ["app_user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_memberships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_memberships_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_memberships_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_memberships_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_memberships_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      shop_promo_redemptions: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_percent: number | null
          extra_promo_days: number
          id: string
          plan_override: string | null
          promo_code_id: string
          promo_ends_at_after: string | null
          promo_ends_at_before: string | null
          redeemed_at: string
          shop_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          extra_promo_days?: number
          id?: string
          plan_override?: string | null
          promo_code_id: string
          promo_ends_at_after?: string | null
          promo_ends_at_before?: string | null
          redeemed_at?: string
          shop_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_percent?: number | null
          extra_promo_days?: number
          id?: string
          plan_override?: string | null
          promo_code_id?: string
          promo_ends_at_after?: string | null
          promo_ends_at_before?: string | null
          redeemed_at?: string
          shop_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shop_promo_redemptions_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shop_promo_redemptions_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
        ]
      }
      shops: {
        Row: {
          billing_started_at: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          owner_device_id: string | null
          plan_updated_at: string
          promo_ends_at: string
          promo_started_at: string
          slug: string
          subscription_plan: string
          subscription_status: string
          updated_at: string
        }
        Insert: {
          billing_started_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          owner_device_id?: string | null
          plan_updated_at?: string
          promo_ends_at?: string
          promo_started_at?: string
          slug: string
          subscription_plan?: string
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          billing_started_at?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          owner_device_id?: string | null
          plan_updated_at?: string
          promo_ends_at?: string
          promo_started_at?: string
          slug?: string
          subscription_plan?: string
          subscription_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_sale_items: {
        Row: {
          batch_product_id: number
          created_by: number | null
          id: number
          product_id: number
          quantity: number
          shop_id: string
          stock_sale_id: number
          subtotal: number
          unit_price: number
          updated_by: number | null
        }
        Insert: {
          batch_product_id: number
          created_by?: number | null
          id?: number
          product_id: number
          quantity?: number
          shop_id: string
          stock_sale_id: number
          subtotal?: number
          unit_price?: number
          updated_by?: number | null
        }
        Update: {
          batch_product_id?: number
          created_by?: number | null
          id?: number
          product_id?: number
          quantity?: number
          shop_id?: string
          stock_sale_id?: number
          subtotal?: number
          unit_price?: number
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_sale_items_batch_product_id_fkey"
            columns: ["batch_product_id"]
            isOneToOne: false
            referencedRelation: "batch_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_sale_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_sale_items_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_sale_items_stock_sale_id_fkey"
            columns: ["stock_sale_id"]
            isOneToOne: false
            referencedRelation: "stock_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_sale_items_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_sales: {
        Row: {
          closed_at: string | null
          closed_by: number | null
          created_at: string
          created_by: number | null
          customer_id: number | null
          customer_name: string | null
          id: number
          sale_channel: string
          sale_uuid: string
          shop_id: string
          status: string
          total_amount: number
          updated_at: string
          updated_by: number | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: number | null
          created_at?: string
          created_by?: number | null
          customer_id?: number | null
          customer_name?: string | null
          id?: number
          sale_channel?: string
          sale_uuid?: string
          shop_id: string
          status?: string
          total_amount?: number
          updated_at?: string
          updated_by?: number | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: number | null
          created_at?: string
          created_by?: number | null
          customer_id?: number | null
          customer_name?: string | null
          id?: number
          sale_channel?: string
          sale_uuid?: string
          shop_id?: string
          status?: string
          total_amount?: number
          updated_at?: string
          updated_by?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_sales_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_sales_shop_id_fkey"
            columns: ["shop_id"]
            isOneToOne: false
            referencedRelation: "shops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_sales_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      bootstrap_shop_workspace:
        | {
            Args: {
              p_email: string
              p_full_name: string
              p_phone?: string
              p_shop_name: string
              p_shop_slug?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_email: string
              p_full_name: string
              p_owner_device_id?: string
              p_phone?: string
              p_shop_name: string
              p_shop_slug?: string
            }
            Returns: Json
          }
      can_access_app_user: { Args: { p_app_user_id: number }; Returns: boolean }
      can_manage_app_user: {
        Args: { p_action: string; p_app_user_id: number }
        Returns: boolean
      }
      consume_request_rate_limit: {
        Args: {
          p_key_hash: string
          p_limit: number
          p_scope: string
          p_window_seconds: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          reset_at: string
          retry_after_seconds: number
        }[]
      }
      cancel_stock_sale_with_stock_restore: {
        Args: { p_sale_id: number; p_shop_id: string }
        Returns: boolean
      }
      create_stock_sale_with_items: {
        Args: {
          p_customer_id: number
          p_customer_name: string
          p_items: Json
          p_sale_channel: string
          p_shop_id: string
          p_total_amount: number
        }
        Returns: {
          id: number
          sale_uuid: string
        }[]
      }
      current_app_user_id: { Args: never; Returns: number }
      current_shop_id: { Args: never; Returns: string }
      delete_batch_cascade: {
        Args: { p_batch_id: number; p_shop_id: string }
        Returns: {
          batch_name: string
          deleted: boolean
        }[]
      }
      delete_cancelled_stock_sale: {
        Args: { p_sale_id: number; p_shop_id: string }
        Returns: boolean
      }
      delete_product_catalog_cascade: {
        Args: { p_product_id: number; p_shop_id: string }
        Returns: boolean
      }
      has_shop_membership: { Args: { p_shop_id: string }; Returns: boolean }
      has_shop_permission: {
        Args: { p_action: string; p_resource: string; p_shop_id: string }
        Returns: boolean
      }
      is_shop_admin: { Args: { p_shop_id: string }; Returns: boolean }
      monthly_sales_record_count: {
        Args: { p_month_start?: string; p_shop_id: string }
        Returns: number
      }
      normalize_promo_code: { Args: { p_code: string }; Returns: string }
      redeem_shop_promo_code: {
        Args: { p_code: string; p_shop_id: string }
        Returns: {
          code: string
          description: string
          discount_percent: number
          extra_promo_days: number
          plan_override: string
          promo_ends_at: string
        }[]
      }
      send_confirmed_arrival_item_to_shipping: {
        Args: { p_arrival_item_id: number; p_shop_id: string }
        Returns: boolean
      }
      send_confirmed_arrivals_to_shipping: {
        Args: { p_batch_name: string; p_shop_id: string }
        Returns: boolean
      }
      send_paid_client_to_deliveries: {
        Args: { p_batch_name: string; p_client_id: number; p_shop_id: string }
        Returns: boolean
      }
      shop_plan_limit: { Args: { p_plan: string }; Returns: number }
      update_stock_sale_with_items: {
        Args: {
          p_customer_id: number
          p_customer_name: string
          p_items: Json
          p_sale_channel: string
          p_sale_id: number
          p_shop_id: string
          p_total_amount: number
        }
        Returns: boolean
      }
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
    Enums: {},
  },
} as const
