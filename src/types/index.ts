/**
 * Domain types for CondoTracker.
 *
 * These mirror the PostgreSQL schema (see supabase/migrations) and are the
 * single source of truth used across server actions, API routes and UI.
 */

// ─── Enums (kept in sync with the DB CHECK constraints) ──────────────────────

/** A resident is `pending` after self-registration (awaiting admin confirm). */
export const RESIDENT_STATUSES = ["pending", "active"] as const;
export type ResidentStatus = (typeof RESIDENT_STATUSES)[number];

/** An expense is `draft` while quote are reviewed; `confirmed` once notified. */
export const EXPENSE_STATUSES = ["draft", "confirmed"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

/**
 * Payment state of a single unit's quota:
 *  - unpaid   → nothing paid yet
 *  - declared → the resident marked it paid (awaiting admin confirmation)
 *  - paid     → the admin confirmed the bank transfer arrived
 */
export const CHARGE_STATUSES = ["unpaid", "declared", "paid"] as const;
export type ChargeStatus = (typeof CHARGE_STATUSES)[number];

// ─── Row shapes ──────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  email_reminders: boolean;
  /** Optional address for reminders (falls back to `email`). */
  reminder_email: string | null;
  created_at: string;
}

/** A condominio managed by an administrator. */
export interface Building {
  id: string;
  admin_id: string | null;
  name: string;
  address: string | null;
  /** Bank account of the condominio (shown to residents for the bonifico). */
  iban: string | null;
  /** Account holder name (intestatario), used in the SEPA QR. */
  bank_holder: string | null;
  /** Shareable code residents use to self-register. */
  invite_code: string;
  notes: string | null;
  created_at: string;
}

/** A millesimi table (es. "Generale", "Scale", "Riscaldamento"). */
export interface MillesimiTable {
  id: string;
  building_id: string;
  name: string;
  is_default: boolean;
  created_at: string;
}

/** A housing unit (unità abitativa) inside a condominio. */
export interface Unit {
  id: string;
  building_id: string;
  label: string;
  floor: string | null;
  description: string | null;
  created_at: string;
}

/** The thousandth share of a unit within a specific millesimi table. */
export interface UnitShare {
  id: string;
  table_id: string;
  unit_id: string;
  millesimi: number;
  created_at: string;
}

/** A condòmino associated with a unit (resident or owner). */
export interface Resident {
  id: string;
  unit_id: string;
  name: string;
  email: string;
  phone: string | null;
  /** Linked auth user once the person registers; null when admin-added only. */
  user_id: string | null;
  status: ResidentStatus;
  created_at: string;
}

/** An expense registered by the admin against a condominio. */
export interface Expense {
  id: string;
  building_id: string;
  /** Millesimi table used to distribute this expense across units. */
  table_id: string;
  title: string;
  description: string | null;
  amount: number;
  expense_date: string | null;
  due_date: string; // ISO date (YYYY-MM-DD)
  document_url: string | null;
  extracted_raw: ParsedDocument | Record<string, unknown> | null;
  status: ExpenseStatus;
  notes: string | null;
  created_at: string;
  confirmed_at: string | null;
}

/** The quota owed by one unit for one expense, with its own payment state. */
export interface Charge {
  id: string;
  expense_id: string;
  unit_id: string;
  amount: number;
  status: ChargeStatus;
  declared_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Document parsing ────────────────────────────────────────────────────────

/**
 * Shape Claude is instructed to return from a parsed expense document
 * (fattura/bolletta/ricevuta). Every field can be `null` when not detectable.
 */
export interface ParsedDocument {
  title: string | null;
  amount: number | null;
  due_date: string | null; // YYYY-MM-DD
  issuer: string | null;
  confidence: number | null;
}

// ─── API contracts ───────────────────────────────────────────────────────────

export interface ParseResponse {
  parsed: ParsedDocument;
  documentUrl: string;
  documentPath: string;
}

export interface ApiError {
  error: string;
  code?: string;
}
