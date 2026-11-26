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
      addresses: {
        Row: {
          address: string
          city: string
          created_at: string
          delivery_type: string
          full_name: string
          id: string
          is_default: boolean
          label: string | null
          notes: string | null
          phone: string
          pickup_station: string | null
          region: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          delivery_type?: string
          full_name: string
          id?: string
          is_default?: boolean
          label?: string | null
          notes?: string | null
          phone: string
          pickup_station?: string | null
          region: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          delivery_type?: string
          full_name?: string
          id?: string
          is_default?: boolean
          label?: string | null
          notes?: string | null
          phone?: string
          pickup_station?: string | null
          region?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          created_at: string
          cta_label: string | null
          id: string
          image_url: string
          is_active: boolean
          link_url: string | null
          sort_order: number
          subtitle: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          cta_label?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          cta_label?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle?: string | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      campaign_events: {
        Row: {
          campaign_id: string
          created_at: string
          event_key: string | null
          event_type: string
          id: string
          metadata: Json
          order_id: string | null
          product_id: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          event_key?: string | null
          event_type: string
          id?: string
          metadata?: Json
          order_id?: string | null
          product_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          event_key?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          order_id?: string | null
          product_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      chat_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      chat_reports: {
        Row: {
          conversation_id: string
          created_at: string
          details: string | null
          id: string
          message_id: string | null
          reason: string
          reported_user_id: string
          reporter_id: string
          status: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          details?: string | null
          id?: string
          message_id?: string | null
          reason: string
          reported_user_id: string
          reporter_id: string
          status?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          details?: string | null
          id?: string
          message_id?: string | null
          reason?: string
          reported_user_id?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          last_message_at: string
          order_id: string | null
          product_id: string | null
          seller_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          last_message_at?: string
          order_id?: string | null
          product_id?: string | null
          seller_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          last_message_at?: string
          order_id?: string | null
          product_id?: string | null
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: string
          expires_at: string | null
          id: string
          is_public: boolean
          max_uses: number | null
          min_spend: number
          seller_id: string | null
          used_count: number
          value: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type: string
          expires_at?: string | null
          id?: string
          is_public?: boolean
          max_uses?: number | null
          min_spend?: number
          seller_id?: string | null
          used_count?: number
          value: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: string
          expires_at?: string | null
          id?: string
          is_public?: boolean
          max_uses?: number | null
          min_spend?: number
          seller_id?: string | null
          used_count?: number
          value?: number
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          eta: string
          fee: number
          id: string
          label: string
          regions: string[]
          sort: number
          updated_at: string
        }
        Insert: {
          eta?: string
          fee?: number
          id: string
          label: string
          regions?: string[]
          sort?: number
          updated_at?: string
        }
        Update: {
          eta?: string
          fee?: number
          id?: string
          label?: string
          regions?: string[]
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      flash_sale_items: {
        Row: {
          flash_sale_id: string
          id: string
          product_id: string
          sale_price: number
        }
        Insert: {
          flash_sale_id: string
          id?: string
          product_id: string
          sale_price: number
        }
        Update: {
          flash_sale_id?: string
          id?: string
          product_id?: string
          sale_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "flash_sale_items_flash_sale_id_fkey"
            columns: ["flash_sale_id"]
            isOneToOne: false
            referencedRelation: "flash_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flash_sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_sales: {
        Row: {
          active: boolean
          created_at: string
          ends_at: string
          id: string
          starts_at: string
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          ends_at: string
          id?: string
          starts_at?: string
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          ends_at?: string
          id?: string
          starts_at?: string
          title?: string
        }
        Relationships: []
      }
      food_order_details: {
        Row: {
          accepted_at: string | null
          completed_at: string | null
          created_at: string
          delivery_fee: number
          dispatched_at: string | null
          fulfillment_method: string
          order_id: string
          preparation_minutes: number
          preparing_at: string | null
          ready_at: string | null
          requested_for: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_fee?: number
          dispatched_at?: string | null
          fulfillment_method: string
          order_id: string
          preparation_minutes?: number
          preparing_at?: string | null
          ready_at?: string | null
          requested_for?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          completed_at?: string | null
          created_at?: string
          delivery_fee?: number
          dispatched_at?: string | null
          fulfillment_method?: string
          order_id?: string
          preparation_minutes?: number
          preparing_at?: string | null
          ready_at?: string | null
          requested_for?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_order_details_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      food_seller_settings: {
        Row: {
          accepting_orders: boolean
          closes_at: string
          created_at: string
          days_open: string[]
          default_preparation_minutes: number
          is_food_seller: boolean
          opens_at: string
          scheduled_orders_enabled: boolean
          seller_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          accepting_orders?: boolean
          closes_at?: string
          created_at?: string
          days_open?: string[]
          default_preparation_minutes?: number
          is_food_seller?: boolean
          opens_at?: string
          scheduled_orders_enabled?: boolean
          seller_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          accepting_orders?: boolean
          closes_at?: string
          created_at?: string
          days_open?: string[]
          default_preparation_minutes?: number
          is_food_seller?: boolean
          opens_at?: string
          scheduled_orders_enabled?: boolean
          seller_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      inbox_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          product_image: string | null
          product_name: string | null
          read: boolean
          title: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          product_image?: string | null
          product_name?: string | null
          read?: boolean
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          product_image?: string | null
          product_name?: string | null
          read?: boolean
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          budget: number | null
          campaign_type: string
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          name: string
          source_id: string | null
          source_type: string | null
          starts_at: string | null
          status: string
          target_config: Json
          target_type: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          campaign_type: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name: string
          source_id?: string | null
          source_type?: string | null
          starts_at?: string | null
          status?: string
          target_config?: Json
          target_type?: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          campaign_type?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          name?: string
          source_id?: string | null
          source_type?: string | null
          starts_at?: string | null
          status?: string
          target_config?: Json
          target_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string
          id: string
          idempotency_key: string
          order_id: string | null
          referral_event_id: string | null
          status: string
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description: string
          id?: string
          idempotency_key: string
          order_id?: string | null
          referral_event_id?: string | null
          status?: string
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string
          id?: string
          idempotency_key?: string
          order_id?: string | null
          referral_event_id?: string | null
          status?: string
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_wallet_transactions_referral_event_id_fkey"
            columns: ["referral_event_id"]
            isOneToOne: false
            referencedRelation: "referral_events"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_wallets: {
        Row: {
          currency: string
          promotional_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          currency?: string
          promotional_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          currency?: string
          promotional_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          delivered: boolean
          id: string
          read: boolean
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          delivered?: boolean
          id?: string
          read?: boolean
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          delivered?: boolean
          id?: string
          read?: boolean
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      moolre_payout_attempts: {
        Row: {
          amount: number
          channel: string
          completed_at: string | null
          created_at: string
          currency: string
          expected_name: string
          externalref: string
          id: string
          moolre_code: string | null
          moolre_message: string | null
          moolre_transaction_id: string | null
          receiver: string
          seller_id: string
          status: string
          txstatus: number | null
          updated_at: string
          validated_name: string | null
          withdrawal_id: string
        }
        Insert: {
          amount: number
          channel: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          expected_name: string
          externalref: string
          id?: string
          moolre_code?: string | null
          moolre_message?: string | null
          moolre_transaction_id?: string | null
          receiver: string
          seller_id: string
          status?: string
          txstatus?: number | null
          updated_at?: string
          validated_name?: string | null
          withdrawal_id: string
        }
        Update: {
          amount?: number
          channel?: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          expected_name?: string
          externalref?: string
          id?: string
          moolre_code?: string | null
          moolre_message?: string | null
          moolre_transaction_id?: string | null
          receiver?: string
          seller_id?: string
          status?: string
          txstatus?: number | null
          updated_at?: string
          validated_name?: string | null
          withdrawal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moolre_payout_attempts_withdrawal_id_fkey"
            columns: ["withdrawal_id"]
            isOneToOne: false
            referencedRelation: "withdrawal_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          pushed: boolean
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          pushed?: boolean
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          pushed?: boolean
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_issues: {
        Row: {
          admin_note: string | null
          created_at: string
          description: string
          id: string
          kind: string
          order_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          description: string
          id?: string
          kind: string
          order_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          description?: string
          id?: string
          kind?: string
          order_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_issues_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          escrow_release_at: string | null
          escrow_released: boolean
          fulfillment_status: string
          id: string
          image_url: string | null
          name: string
          old_price: number | null
          order_id: string
          price: number
          product_id: string | null
          qty: number
          rider_name: string | null
          rider_phone: string | null
          seller_id: string | null
          seller_net: number | null
          tracking_note: string | null
        }
        Insert: {
          escrow_release_at?: string | null
          escrow_released?: boolean
          fulfillment_status?: string
          id?: string
          image_url?: string | null
          name: string
          old_price?: number | null
          order_id: string
          price: number
          product_id?: string | null
          qty: number
          rider_name?: string | null
          rider_phone?: string | null
          seller_id?: string | null
          seller_net?: number | null
          tracking_note?: string | null
        }
        Update: {
          escrow_release_at?: string | null
          escrow_released?: boolean
          fulfillment_status?: string
          id?: string
          image_url?: string | null
          name?: string
          old_price?: number | null
          order_id?: string
          price?: number
          product_id?: string | null
          qty?: number
          rider_name?: string | null
          rider_phone?: string | null
          seller_id?: string | null
          seller_net?: number | null
          tracking_note?: string | null
        }
        Relationships: [
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
        ]
      }
      order_status_history: {
        Row: {
          created_at: string
          id: string
          order_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount_paid: number | null
          cancelled_at: string | null
          cancelled_by: string | null
          coupon_code: string | null
          created_at: string
          delivery_address: string | null
          delivery_city: string | null
          delivery_name: string | null
          delivery_notes: string | null
          delivery_phone: string | null
          delivery_region: string | null
          delivery_type: string
          delivery_zone: string | null
          discount: number
          id: string
          item_count: number
          order_number: string
          payment_method: string
          payment_reference: string | null
          payment_status: string
          paystack_access_code: string | null
          pickup_station: string | null
          refund_note: string | null
          refund_status: string
          refunded_at: string | null
          shipping_fee: number
          status: string
          store_credit_applied: number
          total: number
          user_id: string
        }
        Insert: {
          amount_paid?: number | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          coupon_code?: string | null
          created_at?: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_name?: string | null
          delivery_notes?: string | null
          delivery_phone?: string | null
          delivery_region?: string | null
          delivery_type?: string
          delivery_zone?: string | null
          discount?: number
          id?: string
          item_count: number
          order_number?: string
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          paystack_access_code?: string | null
          pickup_station?: string | null
          refund_note?: string | null
          refund_status?: string
          refunded_at?: string | null
          shipping_fee?: number
          status?: string
          store_credit_applied?: number
          total: number
          user_id: string
        }
        Update: {
          amount_paid?: number | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          coupon_code?: string | null
          created_at?: string
          delivery_address?: string | null
          delivery_city?: string | null
          delivery_name?: string | null
          delivery_notes?: string | null
          delivery_phone?: string | null
          delivery_region?: string | null
          delivery_type?: string
          delivery_zone?: string | null
          discount?: number
          id?: string
          item_count?: number
          order_number?: string
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          paystack_access_code?: string | null
          pickup_station?: string | null
          refund_note?: string | null
          refund_status?: string
          refunded_at?: string | null
          shipping_fee?: number
          status?: string
          store_credit_applied?: number
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_accounts: {
        Row: {
          account_name: string
          account_number: string
          created_at: string
          id: string
          is_default: boolean
          method: string
          provider: string | null
          seller_id: string
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          created_at?: string
          id?: string
          is_default?: boolean
          method: string
          provider?: string | null
          seller_id: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          created_at?: string
          id?: string
          is_default?: boolean
          method?: string
          provider?: string | null
          seller_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      phone_verifications: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      pos_sales: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          discount: number
          id: string
          items: Json
          payment_method: string
          receipt_number: string
          seller_id: string
          subtotal: number
          total: number
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          id?: string
          items?: Json
          payment_method?: string
          receipt_number: string
          seller_id: string
          subtotal?: number
          total?: number
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          discount?: number
          id?: string
          items?: Json
          payment_method?: string
          receipt_number?: string
          seller_id?: string
          subtotal?: number
          total?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          approval_status: string
          barcode: string | null
          category: string | null
          created_at: string
          description: string | null
          discount: number | null
          id: string
          image_url: string | null
          image_urls: string[]
          name: string
          old_price: number | null
          price: number
          seller_id: string | null
          stock: number
        }
        Insert: {
          approval_status?: string
          barcode?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          discount?: number | null
          id?: string
          image_url?: string | null
          image_urls?: string[]
          name: string
          old_price?: number | null
          price: number
          seller_id?: string | null
          stock?: number
        }
        Update: {
          approval_status?: string
          barcode?: string | null
          category?: string | null
          created_at?: string
          description?: string | null
          discount?: number | null
          id?: string
          image_url?: string | null
          image_urls?: string[]
          name?: string
          old_price?: number | null
          price?: number
          seller_id?: string | null
          stock?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          last_seen_at: string | null
          phone: string | null
          phone_verified_at: string | null
          terms_accepted_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          last_seen_at?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          terms_accepted_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          last_seen_at?: string | null
          phone?: string | null
          phone_verified_at?: string | null
          terms_accepted_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
          user_type: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      referral_events: {
        Row: {
          created_at: string
          currency: string
          event_type: string
          id: string
          qualification_amount: number | null
          qualified_at: string | null
          qualified_order_id: string | null
          referral_code_id: string
          referred_user_id: string
          referred_user_type: string
          referrer_user_id: string
          source: string | null
          status: string
        }
        Insert: {
          created_at?: string
          currency?: string
          event_type: string
          id?: string
          qualification_amount?: number | null
          qualified_at?: string | null
          qualified_order_id?: string | null
          referral_code_id: string
          referred_user_id: string
          referred_user_type: string
          referrer_user_id: string
          source?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          currency?: string
          event_type?: string
          id?: string
          qualification_amount?: number | null
          qualified_at?: string | null
          qualified_order_id?: string | null
          referral_code_id?: string
          referred_user_id?: string
          referred_user_type?: string
          referrer_user_id?: string
          source?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_events_qualified_order_id_fkey"
            columns: ["qualified_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_events_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_settings: {
        Row: {
          currency: string
          customer_min_order_amount: number
          customer_referrer_reward: number
          enabled: boolean
          id: boolean
          seller_referrer_reward: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          currency?: string
          customer_min_order_amount?: number
          customer_referrer_reward?: number
          enabled?: boolean
          id?: boolean
          seller_referrer_reward?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          currency?: string
          customer_min_order_amount?: number
          customer_referrer_reward?: number
          enabled?: boolean
          id?: boolean
          seller_referrer_reward?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          order_item_id: string | null
          product_id: string
          rating: number
          seller_id: string | null
          seller_replied_at: string | null
          seller_reply: string | null
          updated_at: string
          user_id: string
          verified_purchase: boolean
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          order_item_id?: string | null
          product_id: string
          rating: number
          seller_id?: string | null
          seller_replied_at?: string | null
          seller_reply?: string | null
          updated_at?: string
          user_id: string
          verified_purchase?: boolean
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          order_item_id?: string | null
          product_id?: string
          rating?: number
          seller_id?: string | null
          seller_replied_at?: string | null
          seller_reply?: string | null
          updated_at?: string
          user_id?: string
          verified_purchase?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_profiles: {
        Row: {
          banner_url: string | null
          bio: string | null
          business_category: string | null
          created_at: string
          deliver_all_regions: boolean
          door_delivery_fee: number
          location: string | null
          logo_url: string | null
          phone: string | null
          pickup_enabled: boolean
          pickup_fee: number
          pickup_region: string | null
          pickup_station: string | null
          shop_name: string
          slug: string | null
          status: string
          store_region: string | null
          updated_at: string
          user_id: string
          verification_note: string | null
          verification_requested_at: string | null
          verification_status: string
          verified_at: string | null
          verified_by: string | null
          whatsapp_number: string | null
        }
        Insert: {
          banner_url?: string | null
          bio?: string | null
          business_category?: string | null
          created_at?: string
          deliver_all_regions?: boolean
          door_delivery_fee?: number
          location?: string | null
          logo_url?: string | null
          phone?: string | null
          pickup_enabled?: boolean
          pickup_fee?: number
          pickup_region?: string | null
          pickup_station?: string | null
          shop_name: string
          slug?: string | null
          status?: string
          store_region?: string | null
          updated_at?: string
          user_id: string
          verification_note?: string | null
          verification_requested_at?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          banner_url?: string | null
          bio?: string | null
          business_category?: string | null
          created_at?: string
          deliver_all_regions?: boolean
          door_delivery_fee?: number
          location?: string | null
          logo_url?: string | null
          phone?: string | null
          pickup_enabled?: boolean
          pickup_fee?: number
          pickup_region?: string | null
          pickup_station?: string | null
          shop_name?: string
          slug?: string | null
          status?: string
          store_region?: string | null
          updated_at?: string
          user_id?: string
          verification_note?: string | null
          verification_requested_at?: string | null
          verification_status?: string
          verified_at?: string | null
          verified_by?: string | null
          whatsapp_number?: string | null
        }
        Relationships: []
      }
      seller_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          payment_reference: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_reference?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_reference?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      seller_verification_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          new_status: string
          note: string | null
          old_status: string | null
          seller_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_status: string
          note?: string | null
          old_status?: string | null
          seller_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          new_status?: string
          note?: string | null
          old_status?: string | null
          seller_id?: string
        }
        Relationships: []
      }
      seller_wallets: {
        Row: {
          balance: number
          commission_paid: number
          created_at: string
          escrow: number
          pending: number
          total_earned: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          commission_paid?: number
          created_at?: string
          escrow?: number
          pending?: number
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          commission_paid?: number
          created_at?: string
          escrow?: number
          pending?: number
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      subscription_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          period_end: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          reference: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          period_end?: string | null
          plan: Database["public"]["Enums"]["subscription_plan"]
          reference: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          period_end?: string | null
          plan?: Database["public"]["Enums"]["subscription_plan"]
          reference?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          commission: number
          featured_slots: number
          features: string[]
          highlight: boolean
          id: Database["public"]["Enums"]["subscription_plan"]
          name: string
          price: number
          product_limit: number | null
          sort_order: number
          tagline: string | null
          updated_at: string
        }
        Insert: {
          commission: number
          featured_slots?: number
          features?: string[]
          highlight?: boolean
          id: Database["public"]["Enums"]["subscription_plan"]
          name: string
          price?: number
          product_limit?: number | null
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          commission?: number
          featured_slots?: number
          features?: string[]
          highlight?: boolean
          id?: Database["public"]["Enums"]["subscription_plan"]
          name?: string
          price?: number
          product_limit?: number | null
          sort_order?: number
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          seller_id: string
          status: string
          type: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          seller_id: string
          status?: string
          type: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          seller_id?: string
          status?: string
          type?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          account_details: string | null
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          method: string
          payout_last_error: string | null
          payout_provider: string | null
          payout_status: string
          payout_updated_at: string | null
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          account_details?: string | null
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          method: string
          payout_last_error?: string | null
          payout_provider?: string | null
          payout_status?: string
          payout_updated_at?: string | null
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          account_details?: string | null
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          method?: string
          payout_last_error?: string | null
          payout_provider?: string | null
          payout_status?: string
          payout_updated_at?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      active_seller_plan: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["subscription_plan"]
      }
      apply_store_credit_to_order: {
        Args: { _order_id: string; _requested_amount?: number }
        Returns: {
          amount_due: number
          applied: number
          balance: number
        }[]
      }
      buyer_cancel_order: { Args: { _order_id: string }; Returns: string }
      cancel_unsubmitted_moolre_withdrawal: {
        Args: { _admin_note?: string; _withdrawal_id: string }
        Returns: boolean
      }
      claim_referral_code: {
        Args: { _code: string; _source?: string }
        Returns: {
          referred_user_type: string
          referrer_user_id: string
        }[]
      }
      complete_referral_event: {
        Args: {
          _amount: number
          _event_id: string
          _event_type: string
          _order_id: string
        }
        Returns: undefined
      }
      confirm_order_received: {
        Args: { _order_id: string }
        Returns: undefined
      }
      create_seller_withdrawal: {
        Args: {
          _amount: number
          _payout_account_id: string
          _seller_id: string
        }
        Returns: string
      }
      finalize_moolre_seller_withdrawal: {
        Args: {
          _moolre_code?: string
          _moolre_message?: string
          _moolre_transaction_id?: string
          _outcome: string
          _txstatus?: number
          _withdrawal_id: string
        }
        Returns: boolean
      }
      get_or_create_my_referral_code: {
        Args: never
        Returns: {
          code: string
          user_type: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { conv_id: string }
        Returns: boolean
      }
      is_order_seller: {
        Args: { _order_id: string; _user_id: string }
        Returns: boolean
      }
      public_food_sellers: {
        Args: never
        Returns: {
          accepting_orders: boolean
          banner_url: string
          bio: string
          business_category: string
          closes_at: string
          days_open: string[]
          default_preparation_minutes: number
          is_open_now: boolean
          location: string
          logo_url: string
          opens_at: string
          product_count: number
          scheduled_orders_enabled: boolean
          shop_name: string
          slug: string
          user_id: string
          verification_status: string
          whatsapp_number: string
        }[]
      }
      public_seller_badge: {
        Args: { _seller_id: string }
        Returns: {
          logo_url: string
          shop_name: string
          slug: string
          verified: boolean
        }[]
      }
      public_store: {
        Args: { _slug: string }
        Returns: {
          banner_url: string
          bio: string
          business_category: string
          created_at: string
          location: string
          logo_url: string
          product_count: number
          shop_name: string
          slug: string
          status: string
          user_id: string
          verification_status: string
          whatsapp_number: string
        }[]
      }
      public_stores: {
        Args: never
        Returns: {
          banner_url: string
          business_category: string
          location: string
          logo_url: string
          product_count: number
          shop_name: string
          slug: string
          verification_status: string
        }[]
      }
      public_vouchers: {
        Args: never
        Returns: {
          code: string
          discount_type: string
          expires_at: string
          min_spend: number
          shop_name: string
          value: number
        }[]
      }
      record_pos_sale: {
        Args: {
          _customer_name?: string
          _customer_phone?: string
          _discount?: number
          _items: Json
          _payment_method: string
        }
        Returns: string
      }
      record_signup_referral: {
        Args: { _code: string; _referred_user_id: string; _source?: string }
        Returns: undefined
      }
      referral_program_is_enabled: { Args: never; Returns: boolean }
      release_seller_escrow: { Args: { _seller_id: string }; Returns: number }
      slugify: { Args: { _txt: string }; Returns: string }
      unique_shop_slug: {
        Args: { _name: string; _user_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "user" | "seller"
      subscription_plan: "free" | "starter" | "premium"
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
      app_role: ["admin", "user", "seller"],
      subscription_plan: ["free", "starter", "premium"],
    },
  },
} as const
