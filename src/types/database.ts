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
      v2_app_settings: {
        Row: {
          key: string
          value: string
          description: string | null
        }
        Insert: {
          key: string
          value: string
          description?: string | null
        }
        Update: {
          key?: string
          value?: string
          description?: string | null
        }
        Relationships: []
      }
      v2_cars: {
        Row: {
          id: string
          name: string
          plate: string
          ownership_type: string
          partner_id: string | null
          has_gps: boolean | null
          daily_rate: number | null
          status: string
          photo_url: string | null
          notes: string | null
          created_at: string | null
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          plate: string
          ownership_type: string
          partner_id?: string | null
          has_gps?: boolean | null
          daily_rate?: number | null
          status?: string
          photo_url?: string | null
          notes?: string | null
          created_at?: string | null
          deleted_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          plate?: string
          ownership_type?: string
          partner_id?: string | null
          has_gps?: boolean | null
          daily_rate?: number | null
          status?: string
          photo_url?: string | null
          notes?: string | null
          created_at?: string | null
          deleted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'v2_cars_partner_id_fkey'
            columns: ['partner_id']
            isOneToOne: false
            referencedRelation: 'v2_partners'
            referencedColumns: ['id']
          },
        ]
      }
      v2_orders: {
        Row: {
          id: string
          car_id: string
          renter_name: string
          renter_phone: string | null
          rental_id: string | null
          status: string
          start_date: string
          end_date: string
          duration_days: number | null
          estimated_income: number | null
          deposit_amount: number | null
          deposit_paid: boolean | null
          cancel_reason: string | null
          cancelled_at: string | null
          notes: string | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          car_id: string
          renter_name: string
          renter_phone?: string | null
          rental_id?: string | null
          status?: string
          start_date: string
          end_date: string
          duration_days?: number | null
          estimated_income?: number | null
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          car_id?: string
          renter_name?: string
          renter_phone?: string | null
          rental_id?: string | null
          status?: string
          start_date?: string
          end_date?: string
          duration_days?: number | null
          estimated_income?: number | null
          deposit_amount?: number | null
          deposit_paid?: boolean | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'v2_orders_car_id_fkey'
            columns: ['car_id']
            isOneToOne: false
            referencedRelation: 'v2_cars'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'v2_orders_rental_id_fkey'
            columns: ['rental_id']
            isOneToOne: false
            referencedRelation: 'v2_rentals'
            referencedColumns: ['id']
          },
        ]
      }
      v2_statuses: {
        Row: {
          id: string
          type: string
          label: string
          color: string
          description: string | null
        }
        Insert: {
          id: string
          type: string
          label: string
          color: string
          description?: string | null
        }
        Update: {
          id?: string
          type?: string
          label?: string
          color?: string
          description?: string | null
        }
        Relationships: []
      }
      v2_partners: {
        Row: {
          id: string
          name: string
          email: string
          phone: string | null
          auth_user_id: string | null
          notes: string | null
          verified: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone?: string | null
          auth_user_id?: string | null
          notes?: string | null
          verified?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string | null
          auth_user_id?: string | null
          notes?: string | null
          verified?: boolean
          created_at?: string | null
        }
        Relationships: []
      }
      v2_renter_info: {
        Row: {
          id: string
          name: string
          phone: string | null
          status: string
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          phone?: string | null
          status?: string
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          phone?: string | null
          status?: string
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v2_rentals: {
        Row: {
          id: string
          car_id: string
          renter_name: string
          renter_phone: string | null
          start_date: string
          start_time: string | null
          end_date: string | null
          end_time: string | null
          duration_days: number | null
          down_payment: number | null
          gross_income: number | null
          status: string
          is_manual: boolean | null
          manual_note: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          car_id: string
          renter_name: string
          renter_phone?: string | null
          start_date: string
          start_time?: string | null
          end_date?: string | null
          end_time?: string | null
          duration_days?: number | null
          down_payment?: number | null
          gross_income?: number | null
          status?: string
          is_manual?: boolean | null
          manual_note?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          car_id?: string
          renter_name?: string
          renter_phone?: string | null
          start_date?: string
          start_time?: string | null
          end_date?: string | null
          end_time?: string | null
          duration_days?: number | null
          down_payment?: number | null
          gross_income?: number | null
          status?: string
          is_manual?: boolean | null
          manual_note?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'v2_rentals_car_id_fkey'
            columns: ['car_id']
            isOneToOne: false
            referencedRelation: 'v2_cars'
            referencedColumns: ['id']
          },
        ]
      }
      v2_transactions: {
        Row: {
          id: string
          car_id: string
          rental_id: string | null
          type: string
          category: string
          amount: number
          auto_fee: boolean | null
          manual_note: string | null
          recorded_at: string | null
        }
        Insert: {
          id?: string
          car_id: string
          rental_id?: string | null
          type: string
          category: string
          amount: number
          auto_fee?: boolean | null
          manual_note?: string | null
          recorded_at?: string | null
        }
        Update: {
          id?: string
          car_id?: string
          rental_id?: string | null
          type?: string
          category?: string
          amount?: number
          auto_fee?: boolean | null
          manual_note?: string | null
          recorded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'v2_transactions_car_id_fkey'
            columns: ['car_id']
            isOneToOne: false
            referencedRelation: 'v2_cars'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'v2_transactions_rental_id_fkey'
            columns: ['rental_id']
            isOneToOne: false
            referencedRelation: 'v2_rentals'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      v2_car_availability: {
        Row: {
          car_id: string | null
          start_date: string | null
          end_date: string | null
          source: string | null
          renter_name: string | null
        }
        Relationships: []
      }
      v2_car_ledger_summary: {
        Row: {
          car_id: string | null
          month: string | null
          total_income: number | null
          total_expense: number | null
          balance: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_order: {
        Args: { p_order_id: string }
        Returns: string
      }
      check_car_availability: {
        Args: { p_car_id: string; p_start: string; p_end: string }
        Returns: { source: string; start_date: string; end_date: string; renter_name: string | null }[]
      }
      claim_partner_for_current_user: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      complete_rental: {
        Args: { p_rental_id: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals['public']

export type Tables<
  TableName extends keyof DefaultSchema['Tables'] | keyof DefaultSchema['Views'],
> = TableName extends keyof DefaultSchema['Tables']
  ? DefaultSchema['Tables'][TableName]['Row']
  : TableName extends keyof DefaultSchema['Views']
    ? DefaultSchema['Views'][TableName]['Row']
    : never

export type TablesInsert<TableName extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][TableName]['Insert']

export type TablesUpdate<TableName extends keyof DefaultSchema['Tables']> =
  DefaultSchema['Tables'][TableName]['Update']
