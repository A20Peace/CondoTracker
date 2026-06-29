/**
 * Minimal typed Database definition for the Supabase client.
 *
 * This is a hand-written subset compatible with `@supabase/supabase-js`
 * generics. For a fully generated version run:
 *   supabase gen types typescript --project-id <id> > src/types/database.ts
 */
import type {
  ChargeStatus,
  ExpenseStatus,
  ParsedDocument,
  ResidentStatus,
} from "./index";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          email: string | null;
          email_reminders: boolean;
          reminder_email: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          email?: string | null;
          email_reminders?: boolean;
          reminder_email?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          email?: string | null;
          email_reminders?: boolean;
          reminder_email?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      buildings: {
        Row: {
          id: string;
          admin_id: string | null;
          name: string;
          address: string | null;
          iban: string | null;
          bank_holder: string | null;
          invite_code: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_id?: string | null;
          name: string;
          address?: string | null;
          iban?: string | null;
          bank_holder?: string | null;
          invite_code?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_id?: string | null;
          name?: string;
          address?: string | null;
          iban?: string | null;
          bank_holder?: string | null;
          invite_code?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      millesimi_tables: {
        Row: {
          id: string;
          building_id: string;
          name: string;
          is_default: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          building_id: string;
          name: string;
          is_default?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          building_id?: string;
          name?: string;
          is_default?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      units: {
        Row: {
          id: string;
          building_id: string;
          label: string;
          floor: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          building_id: string;
          label: string;
          floor?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          building_id?: string;
          label?: string;
          floor?: string | null;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      unit_shares: {
        Row: {
          id: string;
          table_id: string;
          unit_id: string;
          millesimi: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          table_id: string;
          unit_id: string;
          millesimi?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          table_id?: string;
          unit_id?: string;
          millesimi?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      residents: {
        Row: {
          id: string;
          unit_id: string;
          name: string;
          email: string;
          phone: string | null;
          user_id: string | null;
          status: ResidentStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          name: string;
          email: string;
          phone?: string | null;
          user_id?: string | null;
          status?: ResidentStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          unit_id?: string;
          name?: string;
          email?: string;
          phone?: string | null;
          user_id?: string | null;
          status?: ResidentStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          building_id: string;
          table_id: string;
          title: string;
          description: string | null;
          amount: number;
          expense_date: string | null;
          due_date: string;
          document_url: string | null;
          extracted_raw: ParsedDocument | null;
          status: ExpenseStatus;
          notes: string | null;
          created_at: string;
          confirmed_at: string | null;
        };
        Insert: {
          id?: string;
          building_id: string;
          table_id: string;
          title: string;
          description?: string | null;
          amount: number;
          expense_date?: string | null;
          due_date: string;
          document_url?: string | null;
          extracted_raw?: ParsedDocument | null;
          status?: ExpenseStatus;
          notes?: string | null;
          created_at?: string;
          confirmed_at?: string | null;
        };
        Update: {
          id?: string;
          building_id?: string;
          table_id?: string;
          title?: string;
          description?: string | null;
          amount?: number;
          expense_date?: string | null;
          due_date?: string;
          document_url?: string | null;
          extracted_raw?: ParsedDocument | null;
          status?: ExpenseStatus;
          notes?: string | null;
          created_at?: string;
          confirmed_at?: string | null;
        };
        Relationships: [];
      };
      charges: {
        Row: {
          id: string;
          expense_id: string;
          unit_id: string;
          amount: number;
          status: ChargeStatus;
          declared_at: string | null;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          expense_id: string;
          unit_id: string;
          amount: number;
          status?: ChargeStatus;
          declared_at?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          expense_id?: string;
          unit_id?: string;
          amount?: number;
          status?: ChargeStatus;
          declared_at?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sent_reminders: {
        Row: {
          id: string;
          charge_id: string | null;
          kind: string;
          sent_at: string;
        };
        Insert: {
          id?: string;
          charge_id?: string | null;
          kind: string;
          sent_at?: string;
        };
        Update: {
          id?: string;
          charge_id?: string | null;
          kind?: string;
          sent_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
