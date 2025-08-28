export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      budgets: {
        Row: {
          id: string
          user_id: string
          category_id: string
          amount: number
          month: number | null
          year: number | null
          is_recurring: boolean
        }
        Insert: {
          id: string
          user_id: string
          category_id: string
          amount: number
          month?: number | null
          year?: number | null
          is_recurring: boolean
        }
        Update: {
          id?: string
          user_id?: string
          category_id?: string
          amount?: number
          month?: number | null
          year?: number | null
          is_recurring?: boolean
        }
        Relationships: never[]
      }
      categories: {
        Row: {
          id: string
          user_id: string
          name: string
          type: "INCOME" | "EXPENSE"
          color: string | null
          icon: string | null
        }
        Insert: {
          id: string
          user_id: string
          name: string
          type: "INCOME" | "EXPENSE"
          color?: string | null
          icon?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          type?: "INCOME" | "EXPENSE"
          color?: string | null
          icon?: string | null
        }
        Relationships: never[]
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          category_id: string | null
          amount: number
          date: string
          description: string | null
          notes: string | null
        }
        Insert: {
          id: string
          user_id: string
          category_id?: string | null
          amount: number
          date: string
          description?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          category_id?: string | null
          amount?: number
          date?: string
          description?: string | null
          notes?: string | null
        }
        Relationships: never[]
      }
      users: {
        Row: {
          id: string
          email: string | null
        }
        Insert: {
          id: string
          email?: string | null
        }
        Update: {
          id?: string
          email?: string | null
        }
        Relationships: never[]
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

